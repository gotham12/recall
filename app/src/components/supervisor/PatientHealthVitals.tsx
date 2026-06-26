import { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import {
  connectAndSyncHealth,
  disconnectAppleHealth,
  getAppleHealthMeta,
  getHealthVitals,
  hasNativeHealthKitBridge,
  isAppleHealthConnected,
  syncAppleHealthVitals,
  type HealthVitalsSnapshot,
} from '../../lib/appleHealthVitals';
import { isNativeHealthKitApp } from '../../lib/healthKitService';
import StudioIcon from '../StudioIcon';

function formatSyncedAt(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function bpStatus(sys: number, dia: number): { label: string; color: string } {
  if (sys >= 140 || dia >= 90) return { label: 'Elevated', color: '#FF9500' };
  if (sys >= 130 || dia >= 80) return { label: 'Watch', color: '#FF9500' };
  return { label: 'Normal', color: '#34C759' };
}

interface VitalTileProps {
  label: string;
  value: string;
  unit: string;
  icon: 'heart' | 'meds' | 'score';
  accent: string;
  sub?: string;
}

function VitalTile({ label, value, unit, icon, accent, sub }: VitalTileProps) {
  return (
    <div className="health-vital-tile" style={{ borderTopColor: accent }}>
      <div className="health-vital-tile__head">
        <StudioIcon name={icon} size={16} />
        <span className="health-vital-tile__label">{label}</span>
      </div>
      <p className="health-vital-tile__value">
        {value}
        <span className="health-vital-tile__unit">{unit}</span>
      </p>
      {sub && <p className="health-vital-tile__sub">{sub}</p>}
    </div>
  );
}

export default function PatientHealthVitals({ patientName }: { patientName?: string }) {
  const { user } = useAppStore();
  const userId = user?.id;
  const firstName = patientName?.split(' ')[0] ?? 'Patient';

  const [connected, setConnected] = useState(false);
  const [vitals, setVitals] = useState<HealthVitalsSnapshot | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [nativeIos, setNativeIos] = useState(false);
  const [healthKitReady, setHealthKitReady] = useState(false);

  const refresh = useCallback(() => {
    if (!userId) return;
    setConnected(isAppleHealthConnected(userId));
    setVitals(getHealthVitals(userId));
  }, [userId]);

  useEffect(() => {
    refresh();
    setNativeIos(isNativeHealthKitApp());
    void hasNativeHealthKitBridge().then(setHealthKitReady);
  }, [refresh]);

  const handleConnect = async () => {
    if (!userId) return;
    setSyncing(true);
    setError('');
    try {
      const snapshot = await connectAndSyncHealth(userId);
      setConnected(true);
      setVitals(snapshot);
    } catch {
      setError('Could not connect to Apple Health. Try again on your iPhone with Health permissions enabled.');
    } finally {
      setSyncing(false);
    }
  };

  const handleSync = async () => {
    if (!userId) return;
    setSyncing(true);
    setError('');
    try {
      const snapshot = await syncAppleHealthVitals(userId);
      setVitals(snapshot);
    } catch {
      setError('Sync failed — check that Apple Health is connected.');
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = () => {
    if (!userId) return;
    disconnectAppleHealth(userId);
    setConnected(false);
    setVitals(null);
  };

  const meta = userId ? getAppleHealthMeta(userId) : null;
  const bp = vitals ? bpStatus(vitals.bloodPressureSystolic, vitals.bloodPressureDiastolic) : null;

  return (
    <div className="patient-health-vitals">
      <div className="patient-health-vitals__head">
        <div>
          <p className="patient-health-vitals__title">Vitals — {firstName}</p>
          {vitals && (
            <p className="patient-health-vitals__sync">
              {meta?.deviceName ?? 'Apple Watch'} · {formatSyncedAt(vitals.syncedAt)}
            </p>
          )}
        </div>
        {connected ? (
          <span className="vitals-live-badge">
            {vitals?.source === 'healthkit' ? 'HealthKit live' : 'Apple Health'}
          </span>
        ) : (
          <span className="patient-health-vitals__disconnected">Not connected</span>
        )}
      </div>

      {!connected ? (
        <div className="patient-health-vitals__connect card">
          <div className="patient-health-vitals__connect-icon" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" width="32" height="32">
              <path d="M12 4.5C8.5 4.5 5.5 6.5 4 9.5c-.5 1-.5 2-.5 3 0 5 4 9 8.5 12 4.5-3 8.5-7 8.5-12 0-1-.1-2-.5-3C18.5 6.5 15.5 4.5 12 4.5z" fill="#FF2D55" opacity="0.15"/>
              <path d="M12 4.5C8.5 4.5 5.5 6.5 4 9.5c-.5 1-.5 2-.5 3 0 5 4 9 8.5 12 4.5-3 8.5-7 8.5-12 0-1-.1-2-.5-3C18.5 6.5 15.5 4.5 12 4.5z" stroke="#FF2D55" strokeWidth="1.6"/>
            </svg>
          </div>
          <p className="patient-health-vitals__connect-title">Connect Apple Health</p>
          <p className="patient-health-vitals__connect-sub">
            Sync {firstName}&apos;s blood pressure, heart rate, breathing rate, temperature, and walking speed from her Apple Watch.
          </p>
          <button type="button" className="patient-health-vitals__connect-btn tap-feedback" onClick={() => void handleConnect()} disabled={syncing}>
            {syncing ? 'Connecting…' : 'Connect Apple Health'}
          </button>
          <p className="patient-health-vitals__connect-note">
            {nativeIos && healthKitReady
              ? 'Tap connect — iOS will ask which Health data Recall may read.'
              : nativeIos
                ? 'HealthKit is unavailable on this device. Check that Health is enabled in Settings.'
                : 'Install the Recall iOS app on Margaret\'s iPhone for live HealthKit data. Browser preview uses demo values.'}
          </p>
        </div>
      ) : (
        <>
          <div className="health-vitals-grid">
            <VitalTile
              label="Blood Pressure"
              value={`${vitals!.bloodPressureSystolic}/${vitals!.bloodPressureDiastolic}`}
              unit="mmHg"
              icon="heart"
              accent="#FF375F"
              sub={bp?.label}
            />
            <VitalTile
              label="Heart Rate"
              value={String(vitals!.heartRate)}
              unit="BPM"
              icon="heart"
              accent="#FF375F"
              sub="Resting pulse"
            />
            <VitalTile
              label="Respiratory Rate"
              value={String(vitals!.respiratoryRate)}
              unit="/min"
              icon="score"
              accent="#0891B2"
              sub="Breaths per minute"
            />
            <VitalTile
              label="Body Temperature"
              value={vitals!.bodyTempF.toFixed(1)}
              unit="°F"
              icon="meds"
              accent="#FF9500"
              sub="Wrist sensor"
            />
            <VitalTile
              label="Walking Speed"
              value={vitals!.walkingSpeedMph.toFixed(1)}
              unit="mph"
              icon="score"
              accent="#34C759"
              sub="7-day average"
            />
          </div>

          <div className="patient-health-vitals__actions">
            <button type="button" className="patient-health-vitals__sync-btn tap-feedback" onClick={() => void handleSync()} disabled={syncing}>
              {syncing ? 'Syncing…' : 'Sync now'}
            </button>
            <button type="button" className="patient-health-vitals__disconnect tap-feedback" onClick={handleDisconnect}>
              Disconnect
            </button>
          </div>
        </>
      )}

      {error && <p className="patient-health-vitals__error" role="alert">{error}</p>}
    </div>
  );
}
