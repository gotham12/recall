import { useState, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import FlowerStage from './FlowerStage';
import { FLOWERS } from '../flowers';
import { useAppStore } from '../store/appStore';
import { db } from '../db/db';
import { seedIfEmpty } from '../db/seed';

const SUPERVISOR_PASSWORD = 'care2024';

type Role = 'patient' | 'supervisor' | null;

export default function LoginScreen() {
  const { setScreen, setUser } = useAppStore();
  const [role, setRole] = useState<Role>(null);
  const [flowerSrc, setFlowerSrc] = useState<string>(FLOWERS.landing);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [transitioning, setTransitioning] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const swapFlower = (src: string) => setFlowerSrc(src);

  useGSAP(
    () => {
      if (transitioning) {
        gsap.to('.login-panel', { opacity: 0, y: 12, duration: 0.5, ease: 'power2.inOut' });
        gsap.to('.login-top', { opacity: 0, duration: 0.4 });
      } else {
        gsap.fromTo('.login-top', { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' });
        gsap.fromTo('.login-panel', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', delay: 0.1 });
      }
    },
    { scope: panelRef, dependencies: [transitioning] }
  );

  const enterApp = (target: 'patient' | 'supervisor') => {
    setTransitioning(true);
    swapFlower(target === 'patient' ? FLOWERS.patientApp : FLOWERS.supervisorApp);
    setTimeout(() => {
      setScreen(target);
      setTransitioning(false);
    }, 950);
  };

  const handlePatientLogin = async () => {
    await seedIfEmpty();
    const user = await db.users.get(1);
    if (user) setUser(user);
    enterApp('patient');
  };

  const handleSupervisorLogin = async () => {
    if (password !== SUPERVISOR_PASSWORD) {
      setError('Incorrect password. Try care2024.');
      return;
    }
    setError('');
    await seedIfEmpty();
    const user = await db.users.get(1);
    if (user) setUser(user);
    enterApp('supervisor');
  };

  return (
    <div className="studio-screen login-screen">
      <FlowerStage src={flowerSrc} glowIntensity={0.9} variant="hero" />

      <div className="login-top">
        <h1 className="login-title">Recall</h1>
        <p className="login-subtitle">Cognitive care, gently guided</p>
      </div>

      <div ref={panelRef} className="login-panel">
        {role === null && (
          <>
            <p className="login-eyebrow">Sign in</p>
            <p className="login-greeting" style={{ marginBottom: 0 }}>Who is using Recall?</p>
            <div className="login-actions">
              <button
                className="studio-btn studio-btn--primary tap-feedback"
                onClick={() => { swapFlower(FLOWERS.patient); setRole('patient'); }}
              >
                <span className="studio-btn__label">Patient</span>
                <span className="studio-btn__hint">Margaret</span>
              </button>
              <button
                className="studio-btn studio-btn--ghost tap-feedback"
                onClick={() => { swapFlower(FLOWERS.supervisor); setRole('supervisor'); }}
              >
                <span className="studio-btn__label">Supervisor</span>
                <span className="studio-btn__hint">Caregiver access</span>
              </button>
            </div>
          </>
        )}

        {role === 'patient' && (
          <div className="animate-fadeIn">
            <p className="login-eyebrow">Patient</p>
            <p className="login-greeting">Welcome back, Margaret</p>
            <div className="login-actions" style={{ marginTop: 12 }}>
              <button
                className="studio-btn studio-btn--primary tap-feedback"
                onClick={() => { swapFlower(FLOWERS.patientEnter); setTimeout(handlePatientLogin, 420); }}
              >
                <span className="studio-btn__label">Enter Dashboard</span>
              </button>
              <button className="studio-btn studio-btn--text" onClick={() => { swapFlower(FLOWERS.landing); setRole(null); }}>
                Back
              </button>
            </div>
          </div>
        )}

        {role === 'supervisor' && (
          <div className="animate-fadeIn">
            <p className="login-eyebrow">Supervisor</p>
            <p className="login-greeting">Caregiver sign in</p>
            <div className="login-actions" style={{ marginTop: 12 }}>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleSupervisorLogin()}
                placeholder="Password"
                className="studio-input"
                autoFocus
              />
              {error && <p className="studio-error">{error}</p>}
              <button
                className="studio-btn studio-btn--primary tap-feedback"
                onClick={() => { swapFlower(FLOWERS.supervisorEnter); setTimeout(handleSupervisorLogin, 420); }}
              >
                <span className="studio-btn__label">Sign In</span>
              </button>
              <button
                className="studio-btn studio-btn--text"
                onClick={() => { swapFlower(FLOWERS.landing); setRole(null); setPassword(''); setError(''); }}
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
