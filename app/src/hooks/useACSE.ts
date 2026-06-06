import { useCallback, useRef } from 'react';
import { useAppStore } from '../store/appStore';

export function useACSE() {
  const { deductAcse, acseScore } = useAppStore();

  // Track repeated questions
  const questionHistoryRef = useRef<{ text: string; time: number }[]>([]);

  // Track rapid navigation
  const navTimesRef = useRef<number[]>([]);

  // Track inactivity
  const lastActivityRef = useRef<number>(Date.now());
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recordActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);

    // Check inactivity after 20 minutes during active hours (7am-10pm)
    inactivityTimerRef.current = setTimeout(() => {
      const hour = new Date().getHours();
      if (hour >= 7 && hour <= 22) {
        deductAcse(10, 'No interaction for 20+ minutes during active hours');
      }
    }, 20 * 60 * 1000);
  }, [deductAcse]);

  const checkRepeatQuestion = useCallback(
    (question: string) => {
      const now = Date.now();
      const windowMs = 5 * 60 * 1000; // 5 minutes
      const normalized = question.trim().toLowerCase().slice(0, 60);

      // Clean up old entries
      questionHistoryRef.current = questionHistoryRef.current.filter(
        (q) => now - q.time < windowMs
      );

      const duplicate = questionHistoryRef.current.some(
        (q) => q.text === normalized
      );

      if (duplicate) {
        deductAcse(15, 'Same question asked twice within 5 minutes');
      }

      questionHistoryRef.current.push({ text: normalized, time: now });
      recordActivity();
    },
    [deductAcse, recordActivity]
  );

  const recordNavigation = useCallback(() => {
    const now = Date.now();
    navTimesRef.current.push(now);

    // Keep only last 30 seconds
    navTimesRef.current = navTimesRef.current.filter((t) => now - t < 30_000);

    if (navTimesRef.current.length >= 3) {
      deductAcse(10, 'Rapid navigation: 3+ screens in 30 seconds');
      navTimesRef.current = []; // reset to avoid repeated deductions
    }

    recordActivity();
  }, [deductAcse, recordActivity]);

  const recordMedicationReAttempt = useCallback(() => {
    deductAcse(20, 'Medication re-attempt blocked (within 6 hours)');
    recordActivity();
  }, [deductAcse, recordActivity]);

  return {
    acseScore,
    checkRepeatQuestion,
    recordNavigation,
    recordMedicationReAttempt,
    recordActivity,
  };
}
