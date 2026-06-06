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
  const [flowerSrc, setFlowerSrc] = useState(FLOWERS.landing);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [transitioning, setTransitioning] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const swapFlower = (src: string) => setFlowerSrc(src);

  useGSAP(
    () => {
      if (transitioning) {
        gsap.to('.login-panel', {
          opacity: 0,
          y: -24,
          duration: 0.55,
          ease: 'power2.inOut',
        });
        gsap.to('.flower-stage', {
          scale: 1.18,
          duration: 0.9,
          ease: 'power3.inOut',
        });
      } else {
        gsap.fromTo(
          '.login-panel',
          { opacity: 0, y: 28 },
          { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', delay: 0.15 }
        );
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
      setError('Incorrect password. Try "care2024".');
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
      <FlowerStage
        src={flowerSrc}
        glowIntensity={transitioning ? 1.35 : 1}
        className={transitioning ? 'flower-stage--zoom' : ''}
      />

      <div
        ref={panelRef}
        className={`login-panel ${transitioning ? 'login-panel--hidden' : ''}`}
      >
        <p className="login-eyebrow">Welcome</p>
        <h1 className="login-title">Recall</h1>
        <p className="login-subtitle">Who is using Recall today?</p>

        {role === null && (
          <div className="login-actions">
            <button
              className="studio-btn studio-btn--primary tap-feedback"
              onClick={() => {
                swapFlower(FLOWERS.patient);
                setRole('patient');
              }}
            >
              <span className="studio-btn__label">Patient</span>
              <span className="studio-btn__hint">Margaret</span>
            </button>
            <button
              className="studio-btn studio-btn--ghost tap-feedback"
              onClick={() => {
                swapFlower(FLOWERS.supervisor);
                setRole('supervisor');
              }}
            >
              <span className="studio-btn__label">Supervisor</span>
              <span className="studio-btn__hint">Caregiver dashboard</span>
            </button>
          </div>
        )}

        {role === 'patient' && (
          <div className="login-actions animate-fadeIn">
            <p className="login-greeting">Hello, Margaret</p>
            <button
              className="studio-btn studio-btn--primary tap-feedback"
              onClick={() => {
                swapFlower(FLOWERS.patientEnter);
                setTimeout(handlePatientLogin, 420);
              }}
            >
              Enter Dashboard
            </button>
            <button
              className="studio-btn studio-btn--text"
              onClick={() => {
                swapFlower(FLOWERS.landing);
                setRole(null);
              }}
            >
              Back
            </button>
          </div>
        )}

        {role === 'supervisor' && (
          <div className="login-actions animate-fadeIn">
            <p className="login-greeting">Supervisor Access</p>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleSupervisorLogin()}
              placeholder="Enter password"
              className="studio-input"
              autoFocus
            />
            {error && <p className="studio-error">{error}</p>}
            <button
              className="studio-btn studio-btn--primary tap-feedback"
              onClick={() => {
                swapFlower(FLOWERS.supervisorEnter);
                setTimeout(handleSupervisorLogin, 420);
              }}
            >
              Login
            </button>
            <button
              className="studio-btn studio-btn--text"
              onClick={() => {
                swapFlower(FLOWERS.landing);
                setRole(null);
                setPassword('');
                setError('');
              }}
            >
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
