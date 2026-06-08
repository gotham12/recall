import { useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { getPatientVitals, statusColor, type VitalReading } from '../lib/vitals';
import StudioIcon from './StudioIcon';

function VitalCard({ vital, accent }: { vital: VitalReading; accent: string }) {
  const chartData = vital.sparkline.map((v, i) => ({ i, v }));

  return (
    <div className="card vitals-card" style={{ borderTop: `4px solid ${accent}` }}>
      <div className="vitals-card__head">
        <p className="vitals-card__label">{vital.label}</p>
        <span className="vitals-card__badge" style={{ background: `${statusColor(vital.status)}22`, color: statusColor(vital.status) }}>
          {vital.status}
        </span>
      </div>
      <p className="vitals-card__value">
        {vital.value}
        <span className="vitals-card__unit">{vital.unit}</span>
      </p>
      {vital.detail && <p className="vitals-card__detail">{vital.detail}</p>}
      <div className="vitals-card__chart">
        <ResponsiveContainer width="100%" height={48}>
          <LineChart data={chartData}>
            <YAxis hide domain={['dataMin - 2', 'dataMax + 2']} />
            <Line type="monotone" dataKey="v" stroke={accent} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function VitalsDashboard({ patientName }: { patientName?: string }) {
  const vitals = useMemo(() => getPatientVitals(patientName), [patientName]);
  const accents = ['var(--cheer-coral)', 'var(--cheer-sky)', 'var(--cheer-lavender)', 'var(--cheer-sun)', 'var(--cheer-mint)'];

  const sitting = vitals.orthostatic[0];
  const standing = vitals.orthostatic[1];
  const drop = sitting.systolic - standing.systolic;

  return (
    <div className="vitals-dashboard studio-scroll">
      <p className="studio-section-title">Patient vitals</p>
      <p className="vitals-dashboard__time">
        Last updated {new Date(vitals.recordedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
      </p>

      <div className="vitals-grid">
        <VitalCard vital={vitals.heartRate} accent={accents[0]} />
        <VitalCard vital={vitals.respiratoryRate} accent={accents[1]} />
        <VitalCard vital={vitals.weightBmi} accent={accents[2]} />
        <VitalCard vital={vitals.bodyTemp} accent={accents[3]} />
      </div>

      <div className="card vitals-bp-card">
        <div className="vitals-bp-card__head">
          <StudioIcon name="score" size={20} />
          <p className="vitals-bp-card__title">Orthostatic Blood Pressure</p>
        </div>
        <div className="vitals-bp-table">
          <div className="vitals-bp-table__row vitals-bp-table__row--head">
            <span>Position</span><span>BP</span><span>Pulse</span><span>Time</span>
          </div>
          {vitals.orthostatic.map((row) => (
            <div key={row.position} className="vitals-bp-table__row">
              <span>{row.position}</span>
              <span className="vitals-bp-table__bp">{row.systolic}/{row.diastolic} mmHg</span>
              <span>{row.pulse} bpm</span>
              <span>{row.time}</span>
            </div>
          ))}
        </div>
        <p className="vitals-bp-card__note">{vitals.orthostaticNote}</p>
        {drop >= 20 && (
          <p className="vitals-bp-card__alert">
            <StudioIcon name="warning" size={16} />
            Systolic drop of {drop} mmHg on standing
          </p>
        )}
      </div>
    </div>
  );
}
