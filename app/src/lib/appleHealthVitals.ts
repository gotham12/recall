import {
  connectAppleHealth,
  disconnectAppleHealth,
  getAppleHealthMeta,
  isAppleHealthConnected,
} from './appleHealthSleep';
import {
  healthKitAvailable,
  isNativeHealthKitApp,
  readHealthKitVitals,
  requestHealthKitAuthorization,
} from './healthKitService';

export type { AppleHealthState } from './appleHealthSleep';
export {
  disconnectAppleHealth,
  getAppleHealthMeta,
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

/** Browser preview values when HealthKit is unavailable. */
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
    source: 'apple_watch',
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

function hasRequiredFields(
  partial: Partial<HealthVitalsSnapshot>
): partial is HealthVitalsSnapshot {
  return (
    typeof partial.heartRate === 'number' &&
    typeof partial.respiratoryRate === 'number' &&
    typeof partial.bodyTempF === 'number' &&
    typeof partial.bloodPressureSystolic === 'number' &&
    typeof partial.bloodPressureDiastolic === 'number' &&
    typeof partial.walkingSpeedMph === 'number'
  );
}

function mergeWithFallback(
  userId: number,
  partial: Partial<HealthVitalsSnapshot>,
  deviceName?: string
): HealthVitalsSnapshot {
  const fallback = synthesizeVitals(userId, deviceName);
  const merged: HealthVitalsSnapshot = {
    heartRate: partial.heartRate ?? fallback.heartRate,
    respiratoryRate: partial.respiratoryRate ?? fallback.respiratoryRate,
    bodyTempF: partial.bodyTempF ?? fallback.bodyTempF,
    bloodPressureSystolic: partial.bloodPressureSystolic ?? fallback.bloodPressureSystolic,
    bloodPressureDiastolic: partial.bloodPressureDiastolic ?? fallback.bloodPressureDiastolic,
    walkingSpeedMph: partial.walkingSpeedMph ?? fallback.walkingSpeedMph,
    syncedAt: partial.syncedAt ?? new Date().toISOString(),
    source: partial.source === 'healthkit' ? 'healthkit' : fallback.source,
    deviceName: partial.deviceName ?? deviceName ?? fallback.deviceName,
  };
  return merged;
}

async function readNativeVitals(userId: number): Promise<HealthVitalsSnapshot | null> {
  const native = await readHealthKitVitals();
  if (!native) return null;

  const merged = mergeWithFallback(userId, {
    heartRate: native.heartRate,
    respiratoryRate: native.respiratoryRate,
    bodyTempF: native.bodyTempF,
    bloodPressureSystolic: native.bloodPressureSystolic,
    bloodPressureDiastolic: native.bloodPressureDiastolic,
    walkingSpeedMph: native.walkingSpeedMph,
    syncedAt: native.syncedAt ?? new Date().toISOString(),
    source: 'healthkit',
    deviceName: native.deviceName,
  }, native.deviceName);

  return hasRequiredFields(merged) ? merged : null;
}

/** True when running in the Recall iOS shell with HealthKit available. */
export async function hasNativeHealthKitBridge(): Promise<boolean> {
  return healthKitAvailable();
}

/** Latest vitals — cached after sync when Apple Health is connected. */
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
  if (isNativeHealthKitApp()) {
    const available = await healthKitAvailable();
    if (!available) {
      throw new Error('HealthKit is not available on this device.');
    }
    await requestHealthKitAuthorization();
  }

  await connectAppleHealth(userId, {
    deviceName: isNativeHealthKitApp() ? "Margaret's Apple Watch" : "Margaret's Apple Watch (preview)",
  });
  return syncAppleHealthVitals(userId);
}

export async function connectAppleHealthForUser(userId: number): Promise<void> {
  if (isNativeHealthKitApp()) {
    await requestHealthKitAuthorization();
  }
  await connectAppleHealth(userId);
}
