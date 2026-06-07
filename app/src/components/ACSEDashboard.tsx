import type { CSSProperties } from 'react';
import { useAppStore } from '../store/appStore';
import StudioIcon, { type IconName } from './StudioIcon';

export default function ACSEDashboard() {
  const { acseScore, deductAcse, setAcseScore } = useAppStore();

  const moodIcon: IconName =
    acseScore >= 75 ? 'stable' :
    acseScore >= 50 ? 'moderate' :
    'low';

  const status =
    acseScore >= 75
      ? { label: 'Stable', desc: 'You are doing well today. Keep your gentle routine.' }
      : acseScore >= 50
        ? { label: 'Moderate', desc: 'Take things slowly. Clara is here if you need reassurance.' }
        : { label: 'Needs support', desc: 'Comfort mode may open to help you feel grounded.' };

  const triggers = [
    { label: 'Repeated question', points: 15 },
    { label: 'Rapid navigation', points: 10 },
    { label: 'Medication re-attempt', points: 20 },
    { label: 'Inactivity (20 min)', points: 10 },
  ];

  return (
    <div className="acse-dashboard studio-scroll">
      <h2 className="studio-page-title">How you're doing</h2>

      <div className="card acse-dashboard__hero">
        <div className="acse-dashboard__score-ring" style={{ '--score': acseScore } as CSSProperties}>
          <div className="acse-dashboard__score-inner">
            <span className="acse-dashboard__score-value">{acseScore}</span>
            <span className="acse-dashboard__score-of">of 100</span>
          </div>
        </div>
        <div className="acse-dashboard__status">
          <span className="event-icon-badge acse-dashboard__mood">
            <StudioIcon name={moodIcon} size={28} />
          </span>
          <div>
            <p className="acse-dashboard__status-label">{status.label}</p>
            <p className="acse-dashboard__status-desc">{status.desc}</p>
          </div>
        </div>
        <div className="studio-progress-track acse-dashboard__track">
          <div className="acse-dashboard__track-fill" style={{ width: `${acseScore}%` }} />
        </div>
      </div>

      <div className="card acse-dashboard__tips">
        <p className="studio-section-title">Gentle reminders</p>
        <ul className="acse-dashboard__tip-list">
          <li>Take medications when prompted</li>
          <li>Ask Clara if you feel unsure</li>
          <li>Pause and breathe if things feel overwhelming</li>
        </ul>
      </div>

      <div className="card acse-dashboard__demo">
        <p className="studio-section-title">Demo signals</p>
        <div className="acse-dashboard__triggers">
          {triggers.map((t) => (
            <button
              key={t.label}
              type="button"
              className="acse-trigger tap-feedback"
              onClick={() => deductAcse(t.points, t.label)}
            >
              <span>{t.label}</span>
              <span className="acse-trigger__points">−{t.points}</span>
            </button>
          ))}
          <button
            type="button"
            className="studio-btn studio-btn--primary tap-feedback"
            onClick={() => setAcseScore(100)}
          >
            Reset to 100
          </button>
        </div>
      </div>

      <p className="acse-dashboard__footnote">
        Comfort mode opens automatically below 50.
      </p>
    </div>
  );
}
