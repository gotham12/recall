import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useAppStore } from '../store/appStore';
import StudioIcon from './StudioIcon';

/** Real care metrics from on-device data — not synthetic vitals. */
export default function VitalsDashboard({ patientName }: { patientName?: string }) {
  const { user, acseScore } = useAppStore();
  const userId = user?.id;

  const medLogs = useLiveQuery(
    () => (userId ? db.medicationLogs.where('userId').equals(userId).count() : 0),
    [userId]
  ) ?? 0;

  const eventsToday = useLiveQuery(async () => {
    if (!userId) return 0;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const events = await db.events.where('userId').equals(userId).toArray();
    return events.filter((e) => new Date(e.timestamp) >= start).length;
  }, [userId]) ?? 0;

  const comfortEpisodes = useLiveQuery(async () => {
    if (!userId) return 0;
    const alerts = await db.supervisorAlerts.where('userId').equals(userId).toArray();
    return alerts.filter((a) => a.type === 'comfort_mode').length;
  }, [userId]) ?? 0;

  const journalEntries = useLiveQuery(
    () => (userId ? db.careJournal.where('userId').equals(userId).count() : 0),
    [userId]
  ) ?? 0;

  const firstName = patientName?.split(' ')[0] ?? 'Patient';

  const metrics = [
    {
      label: 'ACSE now',
      value: String(acseScore),
      status: acseScore >= 75 ? 'Stable' : acseScore >= 50 ? 'Watch' : 'Support',
      color: acseScore >= 75 ? 'var(--fm-green)' : acseScore >= 50 ? 'var(--fm-yellow-deep)' : '#EF4444',
      icon: 'score' as const,
    },
    {
      label: 'Med verifications',
      value: String(medLogs),
      status: medLogs > 0 ? 'On track' : 'Pending',
      color: 'var(--fm-blue)',
      icon: 'meds' as const,
    },
    {
      label: 'Events today',
      value: String(eventsToday),
      status: 'Logged',
      color: 'var(--fm-blue-light)',
      icon: 'events' as const,
    },
    {
      label: 'Comfort episodes',
      value: String(comfortEpisodes),
      status: comfortEpisodes === 0 ? 'None' : 'Review',
      color: comfortEpisodes > 0 ? 'var(--fm-yellow-deep)' : 'var(--fm-green)',
      icon: 'heart' as const,
    },
    {
      label: 'Care journal',
      value: String(journalEntries),
      status: journalEntries > 0 ? 'Active' : 'Empty',
      color: 'var(--recall-lavender)',
      icon: 'chat' as const,
    },
  ];

  return (
    <div className="vitals-dashboard">
      <div className="vitals-dashboard__head">
        <p className="studio-section-title">Care metrics — {firstName}</p>
        <span className="vitals-live-badge">Live from device</span>
      </div>
      <p className="vitals-dashboard__time">
        Pulled from Recall&apos;s on-device care log — not synthetic vitals.
      </p>

      <div className="care-metrics-grid">
        {metrics.map((m) => (
          <div key={m.label} className="care-metric card" style={{ borderTopColor: m.color }}>
            <div className="care-metric__head">
              <StudioIcon name={m.icon} size={18} />
              <span className="care-metric__status" style={{ color: m.color }}>{m.status}</span>
            </div>
            <p className="care-metric__value">{m.value}</p>
            <p className="care-metric__label">{m.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
