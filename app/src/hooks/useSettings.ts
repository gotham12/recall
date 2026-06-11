import { useCallback, useEffect, useState } from 'react';
import { getSettings, saveSettings, subscribeSettings, type AppSettings } from '../lib/settings';

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => getSettings());

  useEffect(() => subscribeSettings(setSettings), []);

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings(saveSettings(patch));
  }, []);

  const refresh = useCallback(() => {
    setSettings(getSettings());
  }, []);

  return { settings, update, refresh };
}
