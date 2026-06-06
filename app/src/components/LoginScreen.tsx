import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useAppStore } from '../store/appStore';
import { LeafLogo } from './LoadingScreen';

const SUPERVISOR_PASSWORD = 'care';

export default function LoginScreen() {
  const { setScreen, setUser } = useAppStore();
  const [showPw, setShowPw] = useState(false);
  const [pw, setPw] = useState('');
  const [pwErr, setPwErr] = useState(false);
  const user = useLiveQuery(() => db.users.toCollection().first());

  const loginPatient = async () => {
    const u = user ?? await db.users.toCollection().first();
    if (!u) return;
    setUser(u);
    setScreen('patient');
  };

  const loginSupervisor = () => {
    if (pw === SUPERVISOR_PASSWORD) {
      if (user) setUser(user);
      setScreen('supervisor');
    } else {
      setPwErr(true);
      setTimeout(() => setPwErr(false), 1400);
    }
  };

  return (
    <div className="app-shell" style={{ alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
      {/* Dew drops */}
      <div className="dew-dot" style={{ width: 18, height: 18, top: '12%', left: '15%', animation: 'dewPulse 4s ease-in-out infinite' }} />
      <div className="dew-dot" style={{ width: 10, height: 10, top: '18%', left: '28%', animation: 'dewPulse 5s ease-in-out infinite 1s' }} />
      <div className="dew-dot" style={{ width: 24, height: 24, top: '8%',  right: '20%', animation: 'dewPulse 3.5s ease-in-out infinite 0.5s' }} />
      <div className="dew-dot" style={{ width: 12, height: 12, top: '22%', right: '12%', animation: 'dewPulse 4.5s ease-in-out infinite 2s' }} />
      <div className="dew-dot" style={{ width: 8,  height: 8,  bottom: '20%', left: '10%', animation: 'dewPulse 6s ease-in-out infinite 1.5s' }} />
      <div className="dew-dot" style={{ width: 16, height: 16, bottom: '15%', right: '18%', animation: 'dewPulse 5s ease-in-out infinite 0.8s' }} />

      <div style={{ width: '100%', maxWidth: 520, position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: 0 }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <LeafLogo size={52} color="#16A34A" />
          <div style={{ fontFamily: 'Inter', fontWeight: 800, fontSize: 28, color: 'var(--text)', letterSpacing: '-0.5px', marginTop: 10 }}>Recall</div>
          <div className="t-caption" style={{ marginTop: 6 }}>Cognitive care, simplified</div>
        </div>

        {/* Patient card */}
        <div onClick={loginPatient} style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 20, padding: '20px', cursor: 'pointer',
          transition: 'border-color 150ms, background 150ms',
          marginBottom: 12,
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(79,142,247,0.3)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 50, height: 50, borderRadius: 14, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="1.8" strokeLinecap="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div className="t-overline" style={{ marginBottom: 3, color: 'var(--green)' }}>Patient</div>
              <div style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 17, color: 'var(--navy)' }}>{user?.name ?? 'Margaret'}</div>
              <div className="t-caption">Continue as patient</div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </div>
        </div>

        {/* Supervisor */}
        {!showPw ? (
          <div onClick={() => setShowPw(true)} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 20, padding: '20px', cursor: 'pointer',
            transition: 'border-color 150ms',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(79,142,247,0.3)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 50, height: 50, borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--muted-2)" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  <polyline points="9 12 11 14 15 10"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div className="t-overline" style={{ color: 'var(--muted)', marginBottom: 3 }}>Supervisor</div>
                <div style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 17, color: 'var(--navy)' }}>Caregiver dashboard</div>
                <div className="t-caption">Restricted access</div>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </div>
          </div>
        ) : (
          <div style={{ background: 'var(--surface)', border: `1px solid ${pwErr ? 'rgba(239,68,68,0.4)' : 'rgba(79,142,247,0.25)'}`, borderRadius: 20, padding: '20px', transition: 'border-color 150ms' }}>
            <div className="t-label" style={{ marginBottom: 10 }}>Supervisor passcode</div>
            <input
              type="password"
              value={pw}
              onChange={e => { setPw(e.target.value); setPwErr(false); }}
              onKeyDown={e => e.key === 'Enter' && loginSupervisor()}
              placeholder="Enter passcode"
              className="input"
              style={{ marginBottom: pwErr ? 8 : 14, fontSize: 18, letterSpacing: '0.2em' }}
              autoFocus
            />
            {pwErr && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12, fontFamily: 'Inter' }}>Incorrect passcode. Try again.</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => { setShowPw(false); setPw(''); }}>Cancel</button>
              <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={loginSupervisor}>Enter</button>
            </div>
          </div>
        )}

        <div className="t-caption" style={{ textAlign: 'center', marginTop: 28 }}>
          Cognitive care platform · Hackathon demo
        </div>
      </div>
    </div>
  );
}
