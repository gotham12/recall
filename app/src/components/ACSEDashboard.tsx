import { useAppStore } from '../store/appStore';
import { useACSE } from '../hooks/useACSE';

export default function ACSEDashboard() {
  const { acseScore } = useAppStore();
  const { deductAcse } = useAppStore();

  const color =
    acseScore >= 75 ? '#10B981' :
    acseScore >= 50 ? '#F59E0B' :
    '#EF4444';

  const label =
    acseScore >= 75 ? 'Stable' :
    acseScore >= 50 ? 'Moderate' :
    'Low — Comfort Mode Active';

  const triggers = [
    { label: 'Repeated question', points: 15 },
    { label: 'Rapid navigation', points: 10 },
    { label: 'Medication re-attempt', points: 20 },
    { label: 'Inactivity (20 min)', points: 10 },
  ];

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
      <h2 style={{ fontSize: 26, color: '#1A2B4A', margin: '0 0 20px' }}>
        Cognitive Stability
      </h2>

      {/* Score gauge */}
      <div className="card" style={{ padding: '24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: 14, color: '#8A9AB0', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 4px' }}>
              ACSE Score
            </p>
            <p style={{ fontSize: 52, fontWeight: 700, color, margin: 0 }}>
              {acseScore}
            </p>
          </div>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: `${color}22`,
              border: `3px solid ${color}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
            }}
          >
            {acseScore >= 75 ? '😊' : acseScore >= 50 ? '😐' : '😟'}
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ background: '#E5D5C0', borderRadius: 8, height: 12, overflow: 'hidden' }}>
          <div
            style={{
              width: `${acseScore}%`,
              height: '100%',
              background: color,
              borderRadius: 8,
              transition: 'width 0.5s ease, background 0.5s ease',
            }}
          />
        </div>
        <p style={{ fontSize: 18, color, margin: '8px 0 0', fontWeight: 500 }}>{label}</p>
      </div>

      {/* Demo trigger buttons */}
      <div className="card" style={{ padding: '20px', marginBottom: 20 }}>
        <p style={{ fontSize: 16, color: '#8A9AB0', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 12px' }}>
          Demo: Simulate signals
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {triggers.map((t) => (
            <button
              key={t.label}
              className="tap-feedback"
              onClick={() => deductAcse(t.points, t.label)}
              style={{
                background: 'white',
                border: '1.5px solid #E5D5C0',
                borderRadius: 12,
                padding: '12px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 18,
                color: '#1A2B4A',
                cursor: 'pointer',
              }}
            >
              <span>{t.label}</span>
              <span style={{ color: '#EF4444', fontWeight: 600 }}>−{t.points}</span>
            </button>
          ))}
          <button
            className="tap-feedback"
            onClick={() => useAppStore.getState().setAcseScore(100)}
            style={{
              background: '#10B98122',
              border: '1.5px solid #10B981',
              borderRadius: 12,
              padding: '12px 16px',
              fontSize: 18,
              color: '#10B981',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reset to 100 ↺
          </button>
        </div>
      </div>

      <p style={{ fontSize: 16, color: '#8A9AB0', textAlign: 'center' }}>
        Comfort Mode activates automatically when score drops below 50.
      </p>
    </div>
  );
}
