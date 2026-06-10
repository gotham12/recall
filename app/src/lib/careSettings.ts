export interface CareSettings {
  comfortThreshold: number;
  alertOnScoreBelow: number;
  enableSundowningBoost: boolean;
  enablePerseverationDetection: boolean;
  enableNavigationTracking: boolean;
  enableMissedMedAlerts: boolean;
  inactivityMinutes: number;
  recoveryEnabled: boolean;
  notifyOnComfortMode: boolean;
  notifyOnSOS: boolean;
  notifyOnMissedMeds: boolean;
  dailyCheckInHour: number;
  patientDisplayName: string;
}

const STORAGE_KEY = 'recall-care-settings';

export const DEFAULT_CARE_SETTINGS: CareSettings = {
  comfortThreshold: 50,
  alertOnScoreBelow: 60,
  enableSundowningBoost: true,
  enablePerseverationDetection: true,
  enableNavigationTracking: true,
  enableMissedMedAlerts: true,
  inactivityMinutes: 20,
  recoveryEnabled: true,
  notifyOnComfortMode: true,
  notifyOnSOS: true,
  notifyOnMissedMeds: true,
  dailyCheckInHour: 9,
  patientDisplayName: '',
};

export function loadCareSettings(userId?: number): CareSettings {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}-${userId ?? 'default'}`);
    if (raw) return { ...DEFAULT_CARE_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_CARE_SETTINGS };
}

export function saveCareSettings(userId: number, settings: CareSettings): void {
  localStorage.setItem(`${STORAGE_KEY}-${userId}`, JSON.stringify(settings));
}
