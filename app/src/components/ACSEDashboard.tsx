import type { CSSProperties } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAppStore } from '../store/appStore';
import { db, type AcseScore } from '../db/db';
import CognitiveAurora from './CognitiveAurora';
import StudioIcon, { type IconName } from './StudioIcon';

export default function ACSEDashboard() {
  const { acseScore, user } = useAppStore();

  const recentScores = useLiveQuery<AcseScore[]>(
    () =>
      user?.id
        ? db.acseScores.where('userId').equals(user.id).reverse().limit(5).toArray()
        : [],
    [user?.id]
  ) ?? [];

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

  const insights = [
    { icon: 'clara' as IconName, text: 'Talking to Clara when confused helps rebuild context.' },
    { icon: 'meds' as IconName, text: 'Taking medications on schedule keeps your score steady.' },
    { icon: 'heart' as IconName, text: 'Breathing exercises in Comfort Mode can restore calm.' },
  ];

  return (
    <div className="acse-dashboard">
      <h2 className="studio-page-title">How you're doing</h2>

      <div className="card acse-dashboard__hero">
        <CognitiveAurora compact />
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
        <p className="studio-section-title">What helps your stability</p>
        <ul className="acse-dashboard__tip-list">
          {insights.map((item) => (
            <li key={item.text} className="acse-insight">
              <StudioIcon name={item.icon} size={18} />
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      </div>

      {recentScores.length > 0 && (
        <div className="card acse-dashboard__history">
          <p className="studio-section-title">Recent activity</p>
          {recentScores.map((s, i) => (
            <div key={s.id ?? s.timestamp ?? i} className="acse-history-row">
              <span className={`acse-history-row__score acse-history-row__score--${s.score >= 75 ? 'high' : s.score >= 50 ? 'mid' : 'low'}`}>
                {s.score}
              </span>
              <div>
                <p className="acse-history-row__reason">{s.reason || 'Score update'}</p>
                <p className="studio-text-muted" style={{ fontSize: 13, margin: 0 }}>
                  {new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card acse-dashboard__tip">
        <p className="studio-section-title">How ACSE tracks your stability</p>
        <p className="studio-text-muted" style={{ fontSize: 15, margin: 0, lineHeight: 1.55 }}>
          ACSE watches real behavioral signals — not just tab switching. Repeating questions to Clara, similar topic loops, disorientation phrases (&ldquo;where am I?&rdquo;), missed medications, long silence, or medication re-dosing all lower your score. During the sundowning window (4–8 PM), signals weigh more heavily. Calm engagement gradually restores points.
        </p>
      </div>

      <p className="acse-dashboard__footnote">
        ACSE measures behavioral patterns — not a medical diagnosis. Comfort mode opens below 50.
      </p>
    </div>
  );
}
