import { useLiveQuery } from 'dexie-react-hooks';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { useAppStore } from '../../store/appStore';
import { db, type MedicationLog } from '../../db/db';
import StudioIcon from '../StudioIcon';

export default function MedicationAdherence() {
  const { user } = useAppStore();
  const today = new Date().toDateString();

  const logs = useLiveQuery<MedicationLog[]>(
    () => user?.id ? db.medicationLogs.where('userId').equals(user.id).toArray() : [],
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

  const rate = adherence.length === 0
    ? 100
    : Math.round((adherence.filter((a) => a.taken).length / adherence.length) * 100);

  // 7-day adherence trend
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today7 = new Date().getDay();
  const orderedDays = Array.from({ length: 7 }, (_, i) => {
    const dayIdx = (today7 - 6 + i + 7) % 7;
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { label: days[dayIdx], date: d.toDateString() };
  });

  const trendData = orderedDays.map(({ label, date }) => {
    const dayLogs = logs.filter((l) => new Date(l.timestamp).toDateString() === date);
    const totalDoses = user.medications.reduce((sum, m) => sum + m.schedule.length, 0) || 1;
    const taken = dayLogs.length;
    const pct = Math.min(100, Math.round((taken / totalDoses) * 100));
    return { day: label, pct, taken, total: totalDoses };
  });

  // Per-med bar data for today
  const medBarData = adherence.map(({ med, taken }) => ({
    name: med.name.length > 10 ? med.name.slice(0, 10) + '…' : med.name,
    doses: med.schedule.length,
    taken: taken ? med.schedule.length : 0,
  }));

  return (
    <section className="med-adherence card">
      <div className="med-adherence__header">
        <StudioIcon name="meds" size={22} />
        <div>
          <h3 className="studio-section-title" style={{ margin: 0 }}>Medication Adherence</h3>
          <p className="studio-text-muted" style={{ margin: 0, fontSize: 14 }}>
            Today: <strong style={{ color: rate >= 80 ? '#10B981' : rate >= 50 ? '#F59E0B' : '#EF4444' }}>{rate}%</strong> on schedule
          </p>
        </div>
      </div>

      {/* 7-day trend */}
      <p style={{ fontSize: 12, color: 'var(--studio-text-muted)', margin: '10px 0 4px' }}>7-day adherence trend</p>
      <ResponsiveContainer width="100%" height={130}>
        <ComposedChart data={trendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--studio-border)" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 10 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" ticks={[0, 50, 80, 100]} />
          <Tooltip
            formatter={(v: number, name: string) => [
              name === 'pct' ? `${v}%` : v,
              name === 'pct' ? 'Adherence' : name,
            ]}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <ReferenceLine y={80} stroke="#10B981" strokeDasharray="3 3" />
          <Bar dataKey="pct" name="pct" radius={[4, 4, 0, 0]} maxBarSize={32}>
            {trendData.map((d) => (
              <Cell key={d.day} fill={d.pct >= 80 ? '#10B981' : d.pct >= 50 ? '#F59E0B' : '#EF4444'} fillOpacity={0.85} />
            ))}
          </Bar>
          <Line type="monotone" dataKey="pct" stroke="#007AFF" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Per-medication today */}
      {medBarData.length > 0 && (
        <>
          <p style={{ fontSize: 12, color: 'var(--studio-text-muted)', margin: '12px 0 4px' }}>Today by medication</p>
          <ResponsiveContainer width="100%" height={Math.max(60, medBarData.length * 32)}>
            <ComposedChart data={medBarData} layout="vertical" margin={{ left: 8, right: 40, top: 0, bottom: 0 }}>
              <XAxis type="number" domain={[0, 'dataMax']} tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="doses" name="Scheduled" fill="var(--studio-border)" radius={[0, 4, 4, 0]} />
              <Bar dataKey="taken" name="Taken" radius={[0, 4, 4, 0]}>
                {medBarData.map((d) => (
                  <Cell key={d.name} fill={d.taken === d.doses ? '#10B981' : d.taken > 0 ? '#F59E0B' : '#EF4444'} />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </>
      )}

      <ul className="med-adherence__list" style={{ marginTop: 12 }}>
        {adherence.map(({ med, taken, lastLog }) => (
          <li key={med.name} className={`med-adherence__row ${taken ? 'med-adherence__row--ok' : 'med-adherence__row--miss'}`}>
            <StudioIcon name={taken ? 'check' : 'warning'} size={18} />
            <div>
              <p className="med-adherence__name">{med.name}</p>
              <p className="studio-text-muted" style={{ margin: 0, fontSize: 13 }}>
                {med.schedule.join(' · ')}
                {lastLog && ` · Last: ${new Date(lastLog.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
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
