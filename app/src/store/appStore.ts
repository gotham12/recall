import { create } from 'zustand';
import type { User } from '../db/db';
import { db } from '../db/db';

export type AppScreen = 'loading' | 'login' | 'patient' | 'supervisor';

interface SupervisorAlert {
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
  isZooming: boolean;

  setScreen: (screen: AppScreen) => void;
  setUser: (user: User) => void;
  setAcseScore: (score: number) => void;
  deductAcse: (points: number, reason: string) => void;
  activateComfortMode: () => void;
  deactivateComfortMode: () => void;
  addSupervisorAlert: (alert: Omit<SupervisorAlert, 'id'>) => void;
  clearSupervisorAlert: (id: string) => void;
  setIsZooming: (v: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  screen: 'loading',
  user: null,
  acseScore: 100,
  comfortModeActive: false,
  supervisorAlerts: [],
  isZooming: false,

  setScreen: (screen) => set({ screen }),
  setUser: (user) => set({ user }),
  setAcseScore: (score) => set({ acseScore: score }),

  deductAcse: (points, reason) => {
    const current = get().acseScore;
    const next = Math.max(0, current - points);
    set({ acseScore: next });

    if (next < 50 && !get().comfortModeActive) {
      get().activateComfortMode();
    }

    // Persist score to DB
    const user = get().user;
    if (user?.id) {
      db.acseScores.add({
        userId: user.id,
        score: next,
        timestamp: new Date().toISOString(),
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
    });

    if (user?.id) {
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

  addSupervisorAlert: (alert) =>
    set((state) => ({
      supervisorAlerts: [
        { ...alert, id: `${Date.now()}-${Math.random()}` },
        ...state.supervisorAlerts,
      ],
    })),

  clearSupervisorAlert: (id) =>
    set((state) => ({
      supervisorAlerts: state.supervisorAlerts.filter((a) => a.id !== id),
    })),

  setIsZooming: (v) => set({ isZooming: v }),
}));
