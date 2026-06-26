import { Capacitor } from '@capacitor/core';
import { RecallHealthkit } from 'recall-healthkit';

export function isNativeHealthKitApp(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
}

export async function healthKitAvailable(): Promise<boolean> {
  if (!isNativeHealthKitApp()) return false;
  try {
    const { available } = await RecallHealthkit.isAvailable();
    return available;
  } catch {
    return false;
  }
}

export async function requestHealthKitAuthorization(): Promise<void> {
  if (!isNativeHealthKitApp()) return;
  await RecallHealthkit.requestAuthorization();
}

export async function readHealthKitVitals() {
  if (!isNativeHealthKitApp()) return null;
  try {
    return await RecallHealthkit.readLatestVitals();
  } catch (err) {
    console.error('[HealthKit]', err);
    return null;
  }
}
