import { create } from 'zustand';
import type { User } from '../db/db';
import { db } from '../db/db';
import { getStoredTheme, persistTheme, type ThemeMode } from '../lib/theme';
import { preloadFlowers } from '../flowers';
import { publishSync } from '../lib/syncBridge';
import { stopSpeaking } from '../services/elevenlabs';
import { loadCareSettings } from '../lib/careSettings';
import type { AcseSignalId } from '../lib/acseEngine';

export type AppScreen = 'loading' | 'login' | 'patient' | 'supervisor';

interface SupervisorAlert {
  id: string;
  message: string;
  timestamp: string;
  type: 'comfort_mode' | 'medication_unconfirmed' | 'general' | 'sos' | 'presence';
}

export interface AcseSignalEvent {
  id: string;
  signalId: AcseSignalId | 'manual';
  points: number;
  reason: string;
  neurology?: string;
  timestamp: string;
  scoreAfter: number;
}

interface AppState {
  screen: AppScreen;
  user: User | null;
  acseScore: number;
  comfortModeActive: boolean;
  supervisorAlerts: SupervisorAlert[];
  isZooming: boolean;
  theme: ThemeMode;
  demoMode: boolean;
  warmthReceived: boolean;
  acseSignalLog: AcseSignalEvent[];
  memoryRecapActive: boolean;
  memoryRecapReason: 'manual' | 'loneliness' | null;

  setScreen: (screen: AppScreen) => void;
  setUser: (user: User) => void;
  setAcseScore: (score: number) => void;
  deductAcse: (points: number, reason: string, signalId?: AcseSignalId, neurology?: string) => void;
  recoverAcse: (points: number, reason: string) => void;
  activateComfortMode: () => void;
  deactivateComfortMode: () => void;
  previewComfortMode: () => void;
  addSupervisorAlert: (alert: Omit<SupervisorAlert, 'id'> & { persist?: boolean }) => void;
  clearSupervisorAlert: (id: string) => void;
  setIsZooming: (v: boolean) => void;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  resetSession: () => void;
  setDemoMode: (v: boolean) => void;
  setWarmthReceived: (v: boolean) => void;
  applyRemoteAcse: (score: number) => void;
  applyRemoteComfort: (active: boolean) => void;
  triggerMemoryRecap: (reason?: 'manual' | 'loneliness') => void;
  dismissMemoryRecap: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  screen: 'loading',
  user: null,
  acseScore: 100,
  comfortModeActive: false,
  supervisorAlerts: [],
  isZooming: false,
  theme: getStoredTheme(),
  demoMode: false,
  warmthReceived: false,
  acseSignalLog: [],
  memoryRecapActive: false,
  memoryRecapReason: null,

  setScreen: (screen) => set({ screen }),
  setUser: (user) => set({ user }),
  setAcseScore: (score) => {
    set({ acseScore: score });
    const user = get().user;
    if (user?.id) {
      db.acseScores.add({
        userId: user.id,
        score,
        timestamp: new Date().toISOString(),
        reason: 'Manual reset',
      }).catch(console.error);
    }
  },

  deductAcse: (points, reason, signalId, neurology) => {
    const current = get().acseScore;
    const next = Math.max(0, current - points);
    const threshold = loadCareSettings(get().user?.id).comfortThreshold;
    const event: AcseSignalEvent = {
      id: `${Date.now()}-${Math.random()}`,
      signalId: signalId ?? 'manual',
      points: -points,
      reason,
      neurology,
      timestamp: new Date().toISOString(),
      scoreAfter: next,
    };

    set((state) => ({
      acseScore: next,
      acseSignalLog: [event, ...state.acseSignalLog].slice(0, 50),
    }));

    if (next < threshold && !get().comfortModeActive) {
      get().activateComfortMode();
    }

    const user = get().user;
    if (user?.id) {
      db.acseScores.add({
        userId: user.id,
        score: next,
        timestamp: event.timestamp,
        reason,
      }).catch(console.error);
      publishSync(user.id, { type: 'acse', score: next, reason, at: Date.now() });
    }
  },

  recoverAcse: (points, reason) => {
    const current = get().acseScore;
    const next = Math.min(100, current + points);
    if (next === current) return;

    const event: AcseSignalEvent = {
      id: `${Date.now()}-${Math.random()}`,
      signalId: 'recovery',
      points,
      reason,
      neurology: 'Sustained engagement supports cognitive reserve',
      timestamp: new Date().toISOString(),
      scoreAfter: next,
    };

    set((state) => ({
      acseScore: next,
      acseSignalLog: [event, ...state.acseSignalLog].slice(0, 50),
    }));

    const user = get().user;
    if (user?.id) {
      db.acseScores.add({
        userId: user.id,
        score: next,
        timestamp: event.timestamp,
        reason,
      }).catch(console.error);
    }
  },

  activateComfortMode: () => {
    const user = get().user;
    set({ comfortModeActive: true });

    get().addSupervisorAlert({
      message: `Comfort Mode activated at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      timestamp: new Date().toISOString(),
      type: 'comfort_mode',
      persist: true,
    });

    if (user?.id) {
      publishSync(user.id, { type: 'comfort', active: true, at: Date.now() });
      db.events.add({
        userId: user.id,
        timestamp: new Date().toISOString(),
        type: 'system_alert',
        title: 'Comfort Mode activated',
        description: `Comfort Mode activated at ${new Date().toLocaleTimeString()}. ACSE score dropped below 50.`,
        completed: true,
        source: 'system',
      }).catch(console.error);
    }
  },

  deactivateComfortMode: () => {
    set({ comfortModeActive: false, acseScore: 70 });
    const user = get().user;
    if (user?.id) {
      db.acseScores.add({
        userId: user.id,
        score: 70,
        timestamp: new Date().toISOString(),
        reason: 'Comfort Mode completed',
      }).catch(console.error);
    }
  },

  previewComfortMode: () => {
    const current = get().acseScore;
    const drop = current - 45;
    if (drop > 0) {
      get().deductAcse(drop, 'Demo — Comfort Mode preview');
    } else if (!get().comfortModeActive) {
      get().activateComfortMode();
    }
  },

  addSupervisorAlert: (alert) => {
    const id = `${Date.now()}-${Math.random()}`;
    set((state) => ({
      supervisorAlerts: [{ ...alert, id }, ...state.supervisorAlerts],
    }));

    const user = get().user;
    if (user?.id) {
      publishSync(user.id, {
        type: 'alert',
        message: alert.message,
        alertType: alert.type,
        at: Date.now(),
      });
      if (alert.persist !== false) {
        db.supervisorAlerts.add({
          userId: user.id,
          message: alert.message,
          timestamp: alert.timestamp,
          type: alert.type,
          dismissed: false,
        }).catch(console.error);
      }
    }
  },

  clearSupervisorAlert: (id) => {
    set((state) => ({
      supervisorAlerts: state.supervisorAlerts.filter((a) => a.id !== id),
    }));
    const numericId = Number(id);
    if (!Number.isNaN(numericId)) {
      db.supervisorAlerts.update(numericId, { dismissed: true }).catch(console.error);
    }
  },

  setIsZooming: (v) => set({ isZooming: v }),

  setTheme: (theme) => {
    persistTheme(theme);
    preloadFlowers(theme);
    set({ theme });
  },

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    persistTheme(next);
    preloadFlowers(next);
    set({ theme: next });
  },

  resetSession: () =>
    set({
      screen: 'login',
      user: null,
      acseScore: 100,
      comfortModeActive: false,
      supervisorAlerts: [],
      isZooming: false,
      demoMode: false,
      warmthReceived: false,
      acseSignalLog: [],
      memoryRecapActive: false,
      memoryRecapReason: null,
    }),

  setDemoMode: (v) => set({ demoMode: v }),
  setWarmthReceived: (v) => set({ warmthReceived: v }),

  applyRemoteAcse: (score) => set({ acseScore: score }),

  applyRemoteComfort: (active) => {
    set({ comfortModeActive: active });
    if (active && get().acseScore >= 50) {
      set({ acseScore: 45 });
    }
  },

  triggerMemoryRecap: (reason = 'manual') => {
    stopSpeaking();
    set({ memoryRecapActive: true, memoryRecapReason: reason });
  },

  dismissMemoryRecap: () => {
    stopSpeaking();
    set({ memoryRecapActive: false, memoryRecapReason: null });
  },
}));
