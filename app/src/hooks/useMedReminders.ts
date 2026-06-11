import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { getSettings, subscribeSettings } from '../lib/settings';
import { startMedReminderLoop, stopMedReminderLoop } from '../lib/notifications';

export function useMedReminders(): void {
  const user = useAppStore((s) => s.user);
  const screen = useAppStore((s) => s.screen);

  useEffect(() => {
    const sync = () => {
      if (screen === 'patient' && user && getSettings().medReminders) {
        startMedReminderLoop(user);
      } else {
        stopMedReminderLoop();
      }
    };

    sync();
    const unsub = subscribeSettings(sync);
    return () => {
      unsub();
      stopMedReminderLoop();
    };
  }, [user, screen]);
}
