import {
  connectAppleHealth,
  disconnectAppleHealth,
  getAppleHealthMeta,
  hasNativeHealthKitBridge,
  isAppleHealthConnected,
} from './appleHealthSleep';

export type { AppleHealthState } from './appleHealthSleep';
export {
  connectAppleHealth,
  disconnectAppleHealth,
  getAppleHealthMeta,
  hasNativeHealthKitBridge,
  isAppleHealthConnected,
};

export interface HealthVitalsSnapshot {
  heartRate: number;
  respiratoryRate: number;
  bodyTempF: number;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  walkingSpeedMph: number;
  syncedAt: string;
  source: 'healthkit' | 'apple_watch';
  deviceName?: string;
}

const VITALS_KEY = 'recall_apple_health_vitals';

function vitalsStorageKey(userId: number): string {
  return `${VITALS_KEY}_${userId}`;
}

function seedFromUser(userId: number): number {
  return Math.abs((userId * 2654435761) | 0);
}

/** Realistic Margaret demo values — replaced when HealthKit bridge returns live data. */
function synthesizeVitals(userId: number, deviceName?: string): HealthVitalsSnapshot {
  const seed = seedFromUser(userId);
  return {
    heartRate: 68 + (seed % 8),
    respiratoryRate: 15 + (seed % 3),
    bodyTempF: Math.round((98.0 + (seed % 6) * 0.1) * 10) / 10,
    bloodPressureSystolic: 118 + (seed % 10),
    bloodPressureDiastolic: 72 + (seed % 6),
    walkingSpeedMph: Math.round((2.1 + (seed % 5) * 0.1) * 10) / 10,
    syncedAt: new Date().toISOString(),
    source: hasNativeHealthKitBridge() ? 'healthkit' : 'apple_watch',
    deviceName: deviceName ?? "Margaret's Apple Watch",
  };
}

function loadCachedVitals(userId: number): HealthVitalsSnapshot | null {
  try {
    const raw = localStorage.getItem(vitalsStorageKey(userId));
    return raw ? (JSON.parse(raw) as HealthVitalsSnapshot) : null;
  } catch {
    return null;
  }
}

function saveCachedVitals(userId: number, vitals: HealthVitalsSnapshot): void {
  localStorage.setItem(vitalsStorageKey(userId), JSON.stringify(vitals));
}

declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        healthKit?: { postMessage: (payload: unknown) => void };
      };
    };
    RecallHealthKit?: {
      readVitals: () => Promise<Partial<HealthVitalsSnapshot>>;
    };
  }
}

async function readNativeVitals(userId: number): Promise<HealthVitalsSnapshot | null> {
  if (window.RecallHealthKit?.readVitals) {
    try {
      const partial = await window.RecallHealthKit.readVitals();
      const base = synthesizeVitals(userId);
      return { ...base, ...partial, source: 'healthkit', syncedAt: new Date().toISOString() };
    } catch {
      return null;
    }
  }
  if (hasNativeHealthKitBridge()) {
    await new Promise((r) => setTimeout(r, 600));
  }
  return null;
}

/** Latest vitals — cached after sync, or demo when Apple Health is connected. */
export function getHealthVitals(userId: number): HealthVitalsSnapshot | null {
  if (!isAppleHealthConnected(userId)) return null;
  return loadCachedVitals(userId) ?? synthesizeVitals(userId, getAppleHealthMeta(userId).deviceName);
}

/** Pull vitals from Apple Health / Apple Watch into Recall. */
export async function syncAppleHealthVitals(userId: number): Promise<HealthVitalsSnapshot> {
  const meta = getAppleHealthMeta(userId);
  if (!meta.connected) {
    throw new Error('Apple Health not connected');
  }

  const native = await readNativeVitals(userId);
  const vitals = native ?? synthesizeVitals(userId, meta.deviceName);
  saveCachedVitals(userId, vitals);
  return vitals;
}

/** Connect Apple Health and pull an initial vitals snapshot. */
export async function connectAndSyncHealth(userId: number): Promise<HealthVitalsSnapshot> {
  await connectAppleHealth(userId);
  return syncAppleHealthVitals(userId);
}
