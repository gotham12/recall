import { useCallback, useRef } from 'react';
import { useAppStore } from '../store/appStore';

export function useACSE() {
  const deductAcse = useAppStore((s) => s.deductAcse);
  const questionHistoryRef = useRef<{ text: string; time: number }[]>([]);
  const navTimesRef = useRef<number[]>([]);
  const lastActivityRef = useRef<number>(Date.now());
  const inactivityRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recordActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (inactivityRef.current) clearTimeout(inactivityRef.current);
    inactivityRef.current = setTimeout(() => {
      const h = new Date().getHours();
      if (h >= 7 && h <= 22) deductAcse(10, 'No interaction for 20+ minutes during active hours');
    }, 20 * 60 * 1000);
  }, [deductAcse]);

  const checkRepeatQuestion = useCallback((question: string) => {
    const now = Date.now();
    const window5min = 5 * 60 * 1000;
    const norm = question.trim().toLowerCase().slice(0, 60);
    questionHistoryRef.current = questionHistoryRef.current.filter(q => now - q.time < window5min);
    if (questionHistoryRef.current.some(q => q.text === norm)) {
      deductAcse(15, 'Same question asked twice within 5 minutes');
    }
    questionHistoryRef.current.push({ text: norm, time: now });
    recordActivity();
  }, [deductAcse, recordActivity]);

  const recordNavigation = useCallback(() => {
    const now = Date.now();
    navTimesRef.current.push(now);
    navTimesRef.current = navTimesRef.current.filter(t => now - t < 30_000);
    if (navTimesRef.current.length >= 3) {
      deductAcse(10, 'Rapid navigation: 3+ screens in 30 seconds');
      navTimesRef.current = [];
    }
    recordActivity();
  }, [deductAcse, recordActivity]);

  const recordMedicationReAttempt = useCallback(() => {
    deductAcse(20, 'Medication re-attempt blocked within 6 hours');
    recordActivity();
  }, [deductAcse, recordActivity]);

  return { checkRepeatQuestion, recordNavigation, recordMedicationReAttempt, recordActivity };
}
