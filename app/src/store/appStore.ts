import { create } from 'zustand';
import type { User } from '../db/db';
import { db } from '../db/db';

export type AppScreen = 'opening' | 'patient' | 'supervisor';

export interface SupervisorAlert {
  id: string;
  message: string;
  timestamp: string;
  type: 'comfort_mode' | 'medication_unconfirmed' | 'general';
}

interface AppState {
  screen: AppScreen;
  user: User | null;
  acseScore: number;
  comfortModeActive: boolean;
  supervisorAlerts: SupervisorAlert[];

  setScreen: (s: AppScreen) => void;
  setUser: (u: User) => void;
  setAcseScore: (n: number) => void;
  deductAcse: (points: number, reason: string) => void;
  activateComfortMode: () => void;
  deactivateComfortMode: () => void;
  addSupervisorAlert: (a: Omit<SupervisorAlert, 'id'>) => void;
  clearSupervisorAlert: (id: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  screen: 'opening',
  user: null,
  acseScore: 100,
  comfortModeActive: false,
  supervisorAlerts: [],

  setScreen: (screen) => set({ screen }),
  setUser: (user) => set({ user }),
  setAcseScore: (score) => set({ acseScore: score }),

  deductAcse: (points, reason) => {
    const current = get().acseScore;
    const next = Math.max(0, current - points);
    set({ acseScore: next });

    const user = get().user;
    if (user?.id) {
      db.acseScores.add({ userId: user.id, score: next, timestamp: new Date().toISOString(), reason }).catch(console.error);
    }

    if (next < 50 && !get().comfortModeActive) {
      get().activateComfortMode();
    }
  },

  activateComfortMode: () => {
    const user = get().user;
    set({ comfortModeActive: true });

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    get().addSupervisorAlert({
      message: `Comfort Mode activated at ${timeStr}`,
      timestamp: new Date().toISOString(),
      type: 'comfort_mode',
    });

    if (user?.id) {
      db.events.add({
        userId: user.id,
        timestamp: new Date().toISOString(),
        type: 'system_alert',
        title: 'Comfort Mode activated',
        description: `Cognitive Stability Score dropped below 50. Comfort Mode activated at ${timeStr}.`,
        completed: true,
        source: 'system',
      }).catch(console.error);
    }
  },

  deactivateComfortMode: () => {
    set({ comfortModeActive: false });
    const current = get().acseScore;
    set({ acseScore: Math.max(current, 70) });
  },

  addSupervisorAlert: (alert) =>
    set((state) => ({
      supervisorAlerts: [{ ...alert, id: crypto.randomUUID() }, ...state.supervisorAlerts],
    })),

  clearSupervisorAlert: (id) =>
    set((state) => ({
      supervisorAlerts: state.supervisorAlerts.filter((a) => a.id !== id),
    })),
}));
