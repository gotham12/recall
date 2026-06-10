import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { subscribeSync } from '../lib/syncBridge';
import { readStoredPulse } from '../lib/presence';

/** Keeps patient + caregiver tabs in sync via localStorage bridge. */
export function useSyncBridge(): void {
  const user = useAppStore((s) => s.user);
  const screen = useAppStore((s) => s.screen);

  useEffect(() => {
    if (!user?.id || screen === 'loading' || screen === 'login') return;

    return subscribeSync(user.id, (msg) => {
      const store = useAppStore.getState();

      if (msg.type === 'acse') {
        store.applyRemoteAcse(msg.score);
      }
      if (msg.type === 'comfort') {
        store.applyRemoteComfort(msg.active);
      }
      if (msg.type === 'alert') {
        const exists = store.supervisorAlerts.some((a) => a.message === msg.message);
        if (!exists) {
          store.addSupervisorAlert({
            message: msg.message,
            timestamp: new Date(msg.at).toISOString(),
            type: msg.alertType as 'comfort_mode' | 'general' | 'sos' | 'medication_unconfirmed' | 'presence',
            persist: false,
          });
        }
      }
      if (msg.type === 'presence' || msg.type === 'warmth_ack') {
        store.setWarmthReceived(true);
        setTimeout(() => store.setWarmthReceived(false), 8000);
      }
    });
  }, [user?.id, screen]);

  useEffect(() => {
    if (!user?.id) return;
    const poll = window.setInterval(() => {
      const pulse = readStoredPulse(user.id!);
      if (pulse) useAppStore.getState().setWarmthReceived(true);
    }, 3000);
    return () => clearInterval(poll);
  }, [user?.id]);
}
