import { useLiveQuery } from 'dexie-react-hooks';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { db } from '../../db/db';
import { useAppStore } from '../../store/appStore';
import StudioIcon from '../StudioIcon';
import {
  analyzeSleep,
  formatSleepDuration,
  qualityLabel,
} from '../../lib/sleep';

const RISK_COLORS = {
  low: 'var(--fm-green)',
  moderate: 'var(--fm-yellow-deep)',
  elevated: '#EF4444',
};

const TREND_LABELS = {
  improving: 'Improving',
  stable: 'Stable',
  declining: 'Needs attention',
};

export default function SleepClinicalDashboard() {
  const { user } = useAppStore();
  const firstName = user?.name?.split(' ')[0] ?? 'Patient';

  const logs = useLiveQuery(
    () => (user?.id ? db.sleepLogs.where('userId').equals(user.id).sortBy('date') : []),
    [user?.id]
  ) ?? [];

  const report = analyzeSleep(logs);

  const chartData = report.nights.slice(-14).map((n) => ({
    day: new Date(n.date + 'T12:00:00').toLocaleDateString([], { weekday: 'short', month: 'numeric', day: 'numeric' }),
    hours: n.durationHours,
    efficiency: n.efficiency,
    quality: n.quality,
  }));

  return (
    <section className="sleep-clinical card">
      <div className="sleep-clinical__header">
        <StudioIcon name="moon" size={26} />
        <div>
          <h2 className="sleep-clinical__title">Sleep &amp; Neuroprotection — {firstName}</h2>
          <p className="sleep-clinical__sub">
            Sleep quality is a modifiable factor in slowing neurodegenerative progression
          </p>
        </div>
      </div>

      <div className="sleep-clinical__metrics">
        <div className="sleep-clinical-metric">
          <span className="sleep-clinical-metric__value">{formatSleepDuration(report.avgDuration)}</span>
          <span className="sleep-clinical-metric__label">Avg duration</span>
          <span className="sleep-clinical-metric__target">Target: 7–8h</span>
        </div>
        <div className="sleep-clinical-metric">
          <span className="sleep-clinical-metric__value">{Math.round(report.avgEfficiency)}%</span>
          <span className="sleep-clinical-metric__label">Efficiency</span>
          <span className="sleep-clinical-metric__target">Target: &gt;85%</span>
        </div>
        <div className="sleep-clinical-metric">
          <span className="sleep-clinical-metric__value">{report.avgQuality.toFixed(1)}/5</span>
          <span className="sleep-clinical-metric__label">Avg quality</span>
        </div>
        <div className="sleep-clinical-metric">
          <span className="sleep-clinical-metric__value">{report.avgAwakenings.toFixed(1)}</span>
          <span className="sleep-clinical-metric__label">Awakenings/night</span>
        </div>
      </div>

      <div className="sleep-clinical__badges">
        <span
          className="sleep-risk-badge"
          style={{ background: RISK_COLORS[report.riskLevel], color: report.riskLevel === 'moderate' ? '#1a1a1a' : '#fff' }}
        >
          {report.riskLevel === 'low' ? 'Low risk' : report.riskLevel === 'moderate' ? 'Moderate risk' : 'Elevated risk'}
        </span>
        <span className={`sleep-trend-badge sleep-trend-badge--${report.trend}`}>
          Trend: {TREND_LABELS[report.trend]}
        </span>
      </div>

      {chartData.length > 0 ? (
        <div className="sleep-clinical__chart">
          <p className="studio-section-title">Sleep duration (14 nights)</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--studio-border)" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} unit="h" />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === 'hours') return [formatSleepDuration(value), 'Sleep'];
                  return [value, name];
                }}
                contentStyle={{ fontSize: 13, borderRadius: 8 }}
              />
              <Bar dataKey="hours" fill="var(--recall-lavender)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="studio-text-muted sleep-clinical__chart-note">
            Dashed reference: 7h minimum recommended for glymphatic clearance
          </p>
        </div>
      ) : (
        <p className="studio-empty-note">No sleep logs yet — ask Margaret to log from her home screen.</p>
      )}

      <div className="sleep-clinical__section">
        <h3 className="studio-section-title">Clinical interpretation</h3>
        <ul className="sleep-clinical__list">
          {report.interpretation.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </div>

      <div className="sleep-clinical__section sleep-clinical__section--neuro">
        <h3 className="studio-section-title">Neurology — why sleep matters</h3>
        <ul className="sleep-clinical__list sleep-clinical__list--neuro">
          {report.neurologyNotes.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </div>

      <div className="sleep-clinical__section">
        <h3 className="studio-section-title">Care recommendations</h3>
        <ul className="sleep-clinical__list sleep-clinical__list--rec">
          {report.recommendations.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </div>

      {logs.length > 0 && (
        <div className="sleep-clinical__log-table">
          <h3 className="studio-section-title">Recent logs</h3>
          {[...logs].reverse().slice(0, 7).map((log) => {
            const m = report.nights.find((n) => n.date === log.date);
            return (
              <div key={log.id} className="sleep-log-row">
                <span className="sleep-log-row__date">
                  {new Date(log.date + 'T12:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
                <span>{m ? formatSleepDuration(m.durationHours) : '—'}</span>
                <span>{qualityLabel(log.quality)}</span>
                <span>{log.awakenings} wake-ups</span>
                <span className="sleep-log-row__by">{log.loggedBy}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
