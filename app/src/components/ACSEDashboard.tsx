import { useAppStore } from '../store/appStore';

export default function ACSEDashboard() {
  const { acseScore, deductAcse, setAcseScore } = useAppStore();

  const color  = acseScore >= 75 ? 'var(--success)' : acseScore >= 50 ? 'var(--warning)' : 'var(--danger)';
  const label  = acseScore >= 75 ? 'Stable' : acseScore >= 50 ? 'Moderate' : 'Low — Comfort Mode';
  const radius = 44, circ = 2 * Math.PI * radius;

  const triggers = [
    { label: 'Repeated question (simulation)', pts: 15 },
    { label: 'Rapid navigation (simulation)',  pts: 10 },
    { label: 'Medication re-attempt',          pts: 20 },
    { label: 'Inactivity 20 min',              pts: 10 },
  ];

  return (
    <div className="scroll-area" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="t-title">Cognitive Stability</div>

      {/* Gauge */}
      <div className="glass-deep" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <svg width="100" height="100" viewBox="0 0 100 100" style={{ flexShrink: 0 }}>
            <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="10"/>
            <circle cx="50" cy="50" r={radius} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
              strokeDasharray={circ} strokeDashoffset={circ - circ * acseScore / 100}
              transform="rotate(-90 50 50)" style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s' }}/>
            <text x="50" y="55" textAnchor="middle" fontSize="22" fontWeight="800" fill={color} fontFamily="Plus Jakarta Sans">{acseScore}</text>
          </svg>
          <div>
            <div className="t-label" style={{ marginBottom: 4 }}>ACSE Score</div>
            <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 22, fontWeight: 700, color }}>{label}</div>
            <div className="t-caption" style={{ marginTop: 4 }}>Comfort Mode triggers at 50</div>
          </div>
        </div>

        {/* Bar */}
        <div style={{ marginTop: 16, background: 'rgba(0,0,0,0.07)', borderRadius: 8, height: 10, overflow: 'hidden' }}>
          <div style={{ width: `${acseScore}%`, height: '100%', background: color, borderRadius: 8, transition: 'width 0.8s ease, background 0.4s' }}/>
        </div>
      </div>

      {/* Demo triggers */}
      <div className="glass" style={{ padding: 20 }}>
        <div className="t-label" style={{ marginBottom: 12 }}>Demo — Simulate Signals</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {triggers.map(t => (
            <button key={t.label} onClick={() => deductAcse(t.pts, t.label)}
              style={{ background: 'white', border: '1.5px solid rgba(0,0,0,0.08)', borderRadius: 14, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontSize: 16, color: 'var(--navy)', fontFamily: "'Atkinson Hyperlegible',sans-serif" }}>
              <span>{t.label}</span>
              <span style={{ color: 'var(--danger)', fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700 }}>−{t.pts}</span>
            </button>
          ))}
          <button onClick={() => setAcseScore(100)}
            style={{ background: 'rgba(16,185,129,0.1)', border: '1.5px solid rgba(16,185,129,0.25)', borderRadius: 14, padding: '14px 16px', fontSize: 16, color: 'var(--success)', fontWeight: 700, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
            Reset to 100
          </button>
        </div>
      </div>

      <p className="t-caption" style={{ textAlign: 'center' }}>Comfort Mode activates automatically when score drops below 50.</p>
    </div>
  );
}
