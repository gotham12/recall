import { useAppStore } from '../store/appStore';
import StudioIcon, { type IconName } from './StudioIcon';

export default function ACSEDashboard() {
  const { acseScore, deductAcse, setAcseScore } = useAppStore();

  const scoreColor =
    acseScore >= 75 ? 'var(--studio-accent)' :
    acseScore >= 50 ? '#9a7b45' :
    '#c45c5c';

  const label =
    acseScore >= 75 ? 'Stable' :
    acseScore >= 50 ? 'Moderate — monitor closely' :
    'Low — comfort mode may activate';

  const moodIcon: IconName =
    acseScore >= 75 ? 'stable' :
    acseScore >= 50 ? 'moderate' :
    'low';

  const triggers = [
    { label: 'Repeated question', points: 15 },
    { label: 'Rapid navigation', points: 10 },
    { label: 'Medication re-attempt', points: 20 },
    { label: 'Inactivity (20 min)', points: 10 },
  ];

  return (
    <div className="studio-scroll">
      <h2 className="studio-page-title">Cognitive Stability</h2>

      <div className="card" style={{ padding: 22, marginBottom: 16 }}>
        <p className="studio-section-title">ACSE Score</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <p className="studio-stat-value" style={{ fontSize: 52, color: scoreColor }}>{acseScore}</p>
          <span className="event-icon-badge" style={{ width: 52, height: 52 }}>
            <StudioIcon name={moodIcon} size={28} />
          </span>
        </div>
        <div className="studio-progress-track">
          <div style={{ width: `${acseScore}%`, height: '100%', background: 'var(--studio-accent)', borderRadius: 8, transition: 'width 0.5s ease' }} />
        </div>
        <p className="studio-text-bright" style={{ fontSize: 16, margin: '10px 0 0' }}>{label}</p>
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <p className="studio-section-title">Demo signals</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {triggers.map((t) => (
            <button
              key={t.label}
              className="studio-btn tap-feedback"
              onClick={() => deductAcse(t.points, t.label)}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px' }}
            >
              <span className="studio-text-bright" style={{ fontSize: 16 }}>{t.label}</span>
              <span className="studio-text-muted" style={{ fontSize: 16 }}>−{t.points}</span>
            </button>
          ))}
          <button className="studio-btn studio-btn--primary tap-feedback" onClick={() => setAcseScore(100)}>
            Reset to 100
          </button>
        </div>
      </div>

      <p className="studio-text-muted" style={{ fontSize: 15, textAlign: 'center' }}>
        Comfort Mode activates when score drops below 50.
      </p>
    </div>
  );
}
