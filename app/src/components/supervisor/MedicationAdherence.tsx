import { useLiveQuery } from 'dexie-react-hooks';
import { useAppStore } from '../../store/appStore';
import { db, type MedicationLog } from '../../db/db';
import StudioIcon from '../StudioIcon';

export default function MedicationAdherence() {
  const { user } = useAppStore();
  const today = new Date().toDateString();

  const logs = useLiveQuery<MedicationLog[]>(
    () =>
      user?.id
        ? db.medicationLogs.where('userId').equals(user.id).toArray()
        : [],
    [user?.id]
  ) ?? [];

  const todayLogs = logs.filter((l) => new Date(l.timestamp).toDateString() === today);

  if (!user) return null;

  const adherence = user.medications.map((med) => {
    const taken = todayLogs.some((l) => l.medicationName === med.name);
    const lastLog = logs
      .filter((l) => l.medicationName === med.name)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
    return { med, taken, lastLog };
  });

  const rate =
    adherence.length === 0
      ? 100
      : Math.round((adherence.filter((a) => a.taken).length / adherence.length) * 100);

  return (
    <section className="med-adherence card">
      <div className="med-adherence__header">
        <StudioIcon name="meds" size={22} />
        <div>
          <h3 className="studio-section-title" style={{ margin: 0 }}>Medication Adherence</h3>
          <p className="studio-text-muted" style={{ margin: 0, fontSize: 14 }}>
            Today: {rate}% on schedule
          </p>
        </div>
      </div>

      <ul className="med-adherence__list">
        {adherence.map(({ med, taken, lastLog }) => (
          <li key={med.name} className={`med-adherence__row ${taken ? 'med-adherence__row--ok' : 'med-adherence__row--miss'}`}>
            <StudioIcon name={taken ? 'check' : 'warning'} size={18} />
            <div>
              <p className="med-adherence__name">{med.name}</p>
              <p className="studio-text-muted" style={{ margin: 0, fontSize: 13 }}>
                {med.schedule.join(' · ')}
                {lastLog && ` · Last: ${new Date(lastLog.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${lastLog.visionConfidence})`}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {todayLogs.length > 0 && (
        <details className="med-adherence__logs">
          <summary>Today&apos;s intake log ({todayLogs.length})</summary>
          {todayLogs.map((l) => (
            <p key={l.id} className="studio-text-muted" style={{ fontSize: 13, margin: '4px 0' }}>
              {l.medicationName} — {new Date(l.timestamp).toLocaleTimeString()} · {l.visionConfidence}
            </p>
          ))}
        </details>
      )}
    </section>
  );
}
