export type FontScale = 'normal' | 'large' | 'xlarge';

export interface AppSettings {
  easyMode: boolean;
  fontScale: FontScale;
  highContrast: boolean;
  medReminders: boolean;
  consentAccepted: boolean;
  consentVersion: string;
}

const STORAGE_KEY = 'recall-settings';
export const CONSENT_VERSION = '2026.1';

const DEFAULTS: AppSettings = {
  easyMode: false,
  fontScale: 'normal',
  highContrast: false,
  medReminders: true,
  consentAccepted: false,
  consentVersion: CONSENT_VERSION,
};

export function getSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) as Partial<AppSettings> };
  } catch {
    return { ...DEFAULTS };
  }
}

type SettingsListener = (settings: AppSettings) => void;
const listeners = new Set<SettingsListener>();

export function subscribeSettings(listener: SettingsListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifySettings(settings: AppSettings): void {
  for (const listener of listeners) listener(settings);
}

export function saveSettings(patch: Partial<AppSettings>): AppSettings {
  const next = { ...getSettings(), ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  applySettings(next);
  notifySettings(next);
  return next;
}

export function applySettings(settings: AppSettings): void {
  const root = document.documentElement;
  root.dataset.easyMode = settings.easyMode ? 'true' : 'false';
  root.dataset.fontScale = settings.fontScale;
  root.dataset.highContrast = settings.highContrast ? 'true' : 'false';
  document.body.dataset.easyMode = settings.easyMode ? 'true' : 'false';
}

export function initSettings(): AppSettings {
  const settings = getSettings();
  applySettings(settings);
  return settings;
}

export function needsConsent(): boolean {
  const s = getSettings();
  return !s.consentAccepted || s.consentVersion !== CONSENT_VERSION;
}
