import { useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '../store/appStore';
import { db } from '../db/db';
import { loadCareSettings } from '../lib/careSettings';
import {
  buildDeduction,
  detectDisorientation,
  getSundowningMultiplier,
  jaccardSimilarity,
  type AcseSignalId,
} from '../lib/acseEngine';

export function useACSE() {
  const { deductAcse, recoverAcse, acseScore, user } = useAppStore();

  const questionHistoryRef = useRef<{ text: string; normalized: string; time: number }[]>([]);
  const navTimesRef = useRef<number[]>([]);
  const lastActivityRef = useRef<number>(Date.now());
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const missedMedCheckedRef = useRef<string>('');

  const getSettings = useCallback(() => loadCareSettings(user?.id), [user?.id]);

  const applyDeduction = useCallback(
    (signalId: AcseSignalId, basePoints: number, reason: string) => {
      const settings = getSettings();
      const multiplier =
        signalId === 'sundowning' || signalId === 'perseveration' || signalId === 'semantic_loop'
          ? settings.enableSundowningBoost
            ? getSundowningMultiplier()
            : 1
          : 1;
      const d = buildDeduction(signalId, basePoints, reason, multiplier);
      deductAcse(d.points, d.reason, d.signalId, d.neurology);
    },
    [deductAcse, getSettings]
  );

  const recordActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);

    const settings = getSettings();
    const ms = settings.inactivityMinutes * 60 * 1000;

    inactivityTimerRef.current = setTimeout(() => {
      const hour = new Date().getHours();
      if (hour >= 7 && hour <= 22) {
        applyDeduction('inactivity', 10, `No interaction for ${settings.inactivityMinutes}+ minutes`);
      }
    }, ms);

    if (settings.recoveryEnabled && acseScore < 100) {
      if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = setTimeout(() => {
        recoverAcse(3, 'Sustained calm engagement');
      }, 5 * 60 * 1000);
    }
  }, [applyDeduction, recoverAcse, acseScore, getSettings]);

  const checkRepeatQuestion = useCallback(
    (question: string) => {
      const settings = getSettings();
      if (!settings.enablePerseverationDetection) {
        recordActivity();
        return;
      }

      const now = Date.now();
      const windowMs = 5 * 60 * 1000;
      const normalized = question.trim().toLowerCase().slice(0, 120);

      questionHistoryRef.current = questionHistoryRef.current.filter(
        (q) => now - q.time < windowMs
      );

      const exactDup = questionHistoryRef.current.some((q) => q.normalized === normalized);
      const semanticDup = questionHistoryRef.current.some(
        (q) => jaccardSimilarity(q.text, question) >= 0.55
      );

      if (exactDup) {
        applyDeduction('perseveration', 15, 'Same question asked twice within 5 minutes');
      } else if (semanticDup) {
        applyDeduction('semantic_loop', 12, 'Similar question repeated — topic loop detected');
      }

      if (detectDisorientation(question)) {
        applyDeduction('disorientation_speech', 8, 'Disorientation language detected in speech');
      }

      if (settings.enableSundowningBoost && getSundowningMultiplier() > 1) {
        // Sundowning amplifies other deductions; also a passive signal if confused speech during window
        if (detectDisorientation(question) || exactDup || semanticDup) {
          applyDeduction('sundowning', 5, 'Elevated risk during sundowning window (4–8 PM)');
        }
      }

      questionHistoryRef.current.push({ text: question, normalized, time: now });
      recordActivity();
    },
    [applyDeduction, getSettings, recordActivity]
  );

  const recordNavigation = useCallback(() => {
    const settings = getSettings();
    if (!settings.enableNavigationTracking) {
      recordActivity();
      return;
    }

    const now = Date.now();
    navTimesRef.current.push(now);
    navTimesRef.current = navTimesRef.current.filter((t) => now - t < 30_000);

    if (navTimesRef.current.length >= 4) {
      applyDeduction('rapid_navigation', 10, 'Erratic navigation: 4+ screens in 30 seconds');
      navTimesRef.current = [];
    }

    recordActivity();
  }, [applyDeduction, getSettings, recordActivity]);

  const recordMedicationReAttempt = useCallback(() => {
    applyDeduction('medication_confusion', 20, 'Medication re-dosing attempt blocked (within 6 hours)');
    recordActivity();
  }, [applyDeduction, recordActivity]);

  const checkMissedMedications = useCallback(async () => {
    const settings = getSettings();
    if (!settings.enableMissedMedAlerts || !user?.id) return;

    const todayKey = new Date().toDateString();
    if (missedMedCheckedRef.current === todayKey) return;

    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentMins = hour * 60 + minute;

    for (const med of user.medications) {
      for (const slot of med.schedule) {
        const match = slot.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
        if (!match) continue;
        let h = parseInt(match[1]);
        const m = parseInt(match[2] ?? '0');
        const ampm = match[3]?.toLowerCase();
        if (ampm === 'pm' && h < 12) h += 12;
        if (ampm === 'am' && h === 12) h = 0;
        const slotMins = h * 60 + m;

        if (currentMins > slotMins + 90) {
          const logs = await db.medicationLogs
            .where('userId')
            .equals(user.id)
            .and((l) => l.medicationName === med.name)
            .toArray();
          const takenToday = logs.some(
            (l) => new Date(l.timestamp).toDateString() === todayKey
          );
          if (!takenToday) {
            applyDeduction('missed_medication', 12, `Missed ${med.name} window (${slot})`);
            missedMedCheckedRef.current = todayKey;
            return;
          }
        }
      }
    }
  }, [applyDeduction, getSettings, user]);

  useEffect(() => {
    const id = setInterval(() => {
      void checkMissedMedications();
    }, 5 * 60 * 1000);
    void checkMissedMedications();
    return () => clearInterval(id);
  }, [checkMissedMedications]);

  useEffect(() => {
    recordActivity();
    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
    };
  }, [recordActivity]);

  return {
    acseScore,
    checkRepeatQuestion,
    recordNavigation,
    recordMedicationReAttempt,
    recordActivity,
  };
}
