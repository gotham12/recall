import type { PluginListenerHandle } from '@capacitor/core';

export interface RecallHealthkitVitalsPayload {
  heartRate?: number;
  respiratoryRate?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  bodyTempF?: number;
  walkingSpeedMph?: number;
  syncedAt?: string;
  source?: 'healthkit';
  deviceName?: string;
}

export interface RecallHealthkitPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  requestAuthorization(): Promise<void>;
  readLatestVitals(): Promise<RecallHealthkitVitalsPayload>;
  addListener?(
    eventName: string,
    listenerFunc: (...args: unknown[]) => void
  ): Promise<PluginListenerHandle>;
  removeAllListeners?(): Promise<void>;
}

export declare const RecallHealthkit: RecallHealthkitPlugin;
