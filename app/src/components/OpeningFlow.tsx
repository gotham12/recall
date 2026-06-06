import { useRef, useState, useCallback, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import gsap from 'gsap';
import { db } from '../db/db';
import { useAppStore } from '../store/appStore';
import { LeafLogo } from './LeafLogo';

const SUPERVISOR_PASSWORD = 'care';
const HERO_SRC = `${import.meta.env.BASE_URL}dewy-leaf-hero.png`;

type Phase = 'splash' | 'login' | 'zooming';

export default function OpeningFlow() {
  const { setScreen, setUser } = useAppStore();
  const user = useLiveQuery(() => db.users.toCollection().first());

  const [phase, setPhase] = useState<Phase>('splash');
  const [showPw, setShowPw] = useState(false);
  const [pw, setPw] = useState('');
  const [pwErr, setPwErr] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const leafRef = useRef<HTMLDivElement>(null);
  const leafImgRef = useRef<HTMLImageElement>(null);
  const loginRef = useRef<HTMLDivElement>(null);
  const splashRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tl = gsap.timeline();
    tl.fromTo(leafRef.current, { scale: 0.88, opacity: 0 }, { scale: 1, opacity: 1, duration: 1.1, ease: 'power3.out' })
      .fromTo(splashRef.current, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' }, 0.4)
      .fromTo(glowRef.current, { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 0.35, duration: 1.2, ease: 'power2.out' }, 0);
  }, []);

  const revealLogin = useCallback(() => {
    if (phase !== 'splash') return;
    setPhase('login');

    const tl = gsap.timeline();
    tl.to(splashRef.current, { opacity: 0, y: -24, duration: 0.45, ease: 'power2.in' }, 0)
      .to(leafRef.current, { scale: 1.08, y: -40, duration: 0.7, ease: 'power3.out' }, 0)
      .fromTo(loginRef.current,
        { opacity: 0, y: 80, pointerEvents: 'none' },
        { opacity: 1, y: 0, pointerEvents: 'auto', duration: 0.65, ease: 'power3.out' },
        0.15
      )
      .to(glowRef.current, { opacity: 0.55, scale: 1.15, duration: 0.8, ease: 'power2.out' }, 0);
  }, [phase]);

  const zoomToView = useCallback((target: 'patient' | 'supervisor') => {
    if (phase === 'zooming') return;
    setPhase('zooming');

    const tl = gsap.timeline({
      onComplete: () => setScreen(target),
    });

    tl.to(loginRef.current, { opacity: 0, y: 60, scale: 0.96, duration: 0.35, ease: 'power2.in' }, 0)
      .to(leafImgRef.current, {
        scale: 14,
        opacity: 0,
        filter: 'blur(12px) brightness(1.4)',
        duration: 1.1,
        ease: 'power4.in',
      }, 0.05)
      .to(leafRef.current, { scale: 1.2, duration: 1.1, ease: 'power4.in' }, 0.05)
      .to(glowRef.current, { scale: 3, opacity: 0.9, duration: 0.9, ease: 'power2.in' }, 0.1)
      .fromTo(flashRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.35, ease: 'power2.in' },
        0.55
      )
      .to(flashRef.current, { opacity: 0, duration: 0.4, ease: 'power2.out' }, 0.9);
  }, [phase, setScreen]);

  const loginPatient = async () => {
    const u = user ?? await db.users.toCollection().first();
    if (!u) return;
    setUser(u);
    zoomToView('patient');
  };

  const loginSupervisor = () => {
    if (pw !== SUPERVISOR_PASSWORD) {
      setPwErr(true);
      gsap.fromTo(loginRef.current, { x: 0 }, { x: 8, duration: 0.06, repeat: 5, yoyo: true, ease: 'power1.inOut' });
      setTimeout(() => setPwErr(false), 1400);
      return;
    }
    if (user) setUser(user);
    zoomToView('supervisor');
  };

  return (
    <div ref={rootRef} className="opening-flow">
      {/* Ambient glow behind leaf */}
      <div ref={glowRef} className="opening-glow" />

      {/* Dew sparkles */}
      <div className="opening-dew" aria-hidden>
        {[...Array(12)].map((_, i) => (
          <span key={i} className="opening-dew-dot" style={{
            left: `${8 + (i * 7.5) % 84}%`,
            top: `${12 + (i * 11) % 70}%`,
            animationDelay: `${i * 0.35}s`,
            width: 6 + (i % 3) * 4,
            height: 6 + (i % 3) * 4,
          }} />
        ))}
      </div>

      {/* Hero leaf */}
      <div ref={leafRef} className="opening-leaf-wrap">
        <img
          ref={leafImgRef}
          src={HERO_SRC}
          alt=""
          className="opening-leaf-img"
          draggable={false}
        />
        <div className="opening-leaf-shine" aria-hidden />
      </div>

      {/* Splash */}
      <div ref={splashRef} className="opening-splash">
        <div className="opening-brand">
          <LeafLogo size={36} color="#16A34A" />
          <h1 className="opening-title">Recall</h1>
          <p className="opening-tagline">Cognitive Care Platform</p>
        </div>
        <button type="button" className="btn btn-primary opening-login-btn" onClick={revealLogin}>
          Login
        </button>
        <p className="opening-hint">Tap to enter</p>
      </div>

      {/* Login panel — Stitch glass cards */}
      <div ref={loginRef} className="opening-login" style={{ opacity: 0, pointerEvents: 'none' }}>
        <div className="opening-login-header">
          <h2>Welcome</h2>
          <p>Who is using Recall today?</p>
        </div>

        <button type="button" className="opening-role-card" onClick={loginPatient}>
          <div className="opening-role-icon opening-role-icon--patient">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div className="opening-role-text">
            <span className="opening-role-label">Patient</span>
            <strong>{user?.name ?? 'Margaret'}</strong>
            <span className="opening-role-sub">Continue as patient</span>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </button>

        {!showPw ? (
          <button type="button" className="opening-role-card" onClick={() => setShowPw(true)}>
            <div className="opening-role-icon opening-role-icon--supervisor">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>
              </svg>
            </div>
            <div className="opening-role-text">
              <span className="opening-role-label">Supervisor</span>
              <strong>Caregiver dashboard</strong>
              <span className="opening-role-sub">Restricted access</span>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>
        ) : (
          <div className={`opening-pw-card ${pwErr ? 'opening-pw-card--err' : ''}`}>
            <label className="t-label">Supervisor passcode</label>
            <input
              type="password"
              value={pw}
              onChange={e => { setPw(e.target.value); setPwErr(false); }}
              onKeyDown={e => e.key === 'Enter' && loginSupervisor()}
              placeholder="Enter passcode"
              className="input"
              autoFocus
            />
            {pwErr && <p className="opening-pw-err">Incorrect passcode</p>}
            <div className="opening-pw-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowPw(false); setPw(''); }}>Cancel</button>
              <button type="button" className="btn btn-primary btn-sm" onClick={loginSupervisor}>Enter</button>
            </div>
          </div>
        )}

        {phase === 'login' && (
          <button type="button" className="opening-back" onClick={() => {
            setPhase('splash');
            setShowPw(false);
            setPw('');
            gsap.set(loginRef.current, { opacity: 0, y: 80, pointerEvents: 'none' });
            gsap.to(splashRef.current, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' });
            gsap.to(leafRef.current, { scale: 1, y: 0, duration: 0.6, ease: 'power3.out' });
            gsap.to(glowRef.current, { opacity: 0.35, scale: 1, duration: 0.5 });
          }}>
            Back to leaf
          </button>
        )}
      </div>

      {/* Zoom-through flash */}
      <div ref={flashRef} className="opening-flash" />
    </div>
  );
}
