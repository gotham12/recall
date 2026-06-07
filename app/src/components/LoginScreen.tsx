import { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import FlowerStage from './FlowerStage';
import AnimatedPanel from './AnimatedPanel';
import RecallLogo from './RecallLogo';
import { FLOWERS } from '../flowers';
import { useAppStore } from '../store/appStore';
import { db, type User } from '../db/db';
import { seedIfEmpty } from '../db/seed';
import { duration, EASE } from '../lib/motion';
import { checkSupervisorAuth } from '../lib/auth';

type Role = 'patient' | 'supervisor' | null;

export default function LoginScreen() {
  const { setScreen, setUser } = useAppStore();
  const [role, setRole] = useState<Role>(null);
  const [selectedPatient, setSelectedPatient] = useState<User | null>(null);
  const [flowerSrc, setFlowerSrc] = useState<string>(FLOWERS.landing);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [transitioning, setTransitioning] = useState(false);
  const screenRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const patients = useLiveQuery(() => db.users.toArray(), []) ?? [];

  const swapFlower = (src: string) => setFlowerSrc(src);

  useEffect(() => {
    void seedIfEmpty();
  }, []);

  useEffect(() => {
    if (!error) return;
    const el = panelRef.current?.querySelector('.studio-error');
    if (el) {
      gsap.fromTo(el, { x: -8 }, { x: 0, duration: 0.45, ease: 'elastic.out(1, 0.55)' });
    }
  }, [error]);

  useGSAP(
    () => {
      gsap.set('.login-actions .studio-btn', { opacity: 1, y: 0 });

      if (transitioning) {
        const tl = gsap.timeline({ defaults: { ease: EASE.smooth } });
        tl.to('.login-panel', { opacity: 0, y: 16, duration: duration(0.55) }, 0)
          .to('.login-top', { opacity: 0, y: -8, duration: duration(0.45) }, 0)
          .to('.flower-stage', { opacity: 0.6, duration: duration(0.7) }, 0);
      } else {
        gsap.fromTo(
          '.login-top',
          { opacity: 0, y: -14 },
          { opacity: 1, y: 0, duration: duration(0.9), ease: EASE.enter }
        );
        gsap.fromTo(
          '.login-panel',
          { opacity: 0, y: 24 },
          { opacity: 1, y: 0, duration: duration(0.85), ease: EASE.enter, delay: 0.15 }
        );
      }
    },
    { scope: screenRef, dependencies: [transitioning] }
  );

  const enterApp = (target: 'patient' | 'supervisor') => {
    setTransitioning(true);
    swapFlower(target === 'patient' ? FLOWERS.patientApp : FLOWERS.supervisorApp);
    setTimeout(() => {
      setScreen(target);
      setTransitioning(false);
    }, duration(1100, 50));
  };

  const handlePatientLogin = async (patient: User) => {
    await seedIfEmpty();
    setUser(patient);
    enterApp('patient');
  };

  const handleSupervisorLogin = async () => {
    const auth = checkSupervisorAuth(password);
    if (!auth.ok) {
      setError(auth.error ?? 'Incorrect password.');
      return;
    }
    setError('');
    await seedIfEmpty();
    const user = await db.users.toArray();
    if (user[0]) setUser(user[0]);
    enterApp('supervisor');
  };

  return (
    <div ref={screenRef} className="studio-screen login-screen">
      <FlowerStage src={flowerSrc} glowIntensity={0.9} variant="hero" />

      <div className="login-top">
        <RecallLogo size="lg" />
        <p className="login-subtitle">Cognitive care, gently guided</p>
      </div>

      <div ref={panelRef} className="login-panel">
        {role === null && (
          <AnimatedPanel panelKey="landing" stagger>
            <p className="login-eyebrow">Sign in</p>
            <p className="login-greeting" style={{ marginBottom: 0 }}>Who is using Recall?</p>
            <div className="login-actions login-actions--role-select">
              <button
                className="studio-btn studio-btn--primary tap-feedback"
                onClick={() => { swapFlower(FLOWERS.patient); setRole('patient'); setSelectedPatient(null); }}
              >
                <span className="studio-btn__label">Patient</span>
                <span className="studio-btn__hint">Daily care</span>
              </button>
              <button
                className="studio-btn studio-btn--ghost tap-feedback"
                onClick={() => { swapFlower(FLOWERS.supervisor); setRole('supervisor'); }}
              >
                <span className="studio-btn__label">Supervisor</span>
                <span className="studio-btn__hint">Caregiver access</span>
              </button>
            </div>
          </AnimatedPanel>
        )}

        {role === 'patient' && !selectedPatient && (
          <AnimatedPanel panelKey="patient-select" stagger>
            <p className="login-eyebrow">Patient</p>
            <p className="login-greeting">Who are you today?</p>
            <div className="login-actions login-actions--role-select">
              {patients.map((p) => (
                <button
                  key={p.id}
                  className="studio-btn studio-btn--primary tap-feedback"
                  onClick={() => {
                    setSelectedPatient(p);
                    swapFlower(FLOWERS.patient);
                  }}
                >
                  <span className="studio-btn__label">{p.name}</span>
                  <span className="studio-btn__hint">{p.city}</span>
                </button>
              ))}
              {patients.length === 0 && (
                <p className="studio-text-muted">Loading profiles…</p>
              )}
              <button
                className="studio-btn studio-btn--text"
                onClick={() => { swapFlower(FLOWERS.landing); setRole(null); }}
              >
                Back
              </button>
            </div>
          </AnimatedPanel>
        )}

        {role === 'patient' && selectedPatient && (
          <AnimatedPanel panelKey={`patient-${selectedPatient.id}`} stagger>
            <p className="login-eyebrow">Patient</p>
            <p className="login-greeting">Welcome back, {selectedPatient.name.split(' ')[0]}</p>
            <div className="login-actions login-actions--role-select" style={{ marginTop: 12 }}>
              <button
                className="studio-btn studio-btn--primary tap-feedback"
                onClick={() => { swapFlower(FLOWERS.patientEnter); setTimeout(() => handlePatientLogin(selectedPatient), 520); }}
              >
                <span className="studio-btn__label">Enter Dashboard</span>
              </button>
              <button
                className="studio-btn studio-btn--text"
                onClick={() => { setSelectedPatient(null); swapFlower(FLOWERS.landing); }}
              >
                Back
              </button>
            </div>
          </AnimatedPanel>
        )}

        {role === 'supervisor' && (
          <AnimatedPanel panelKey="supervisor" stagger>
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
                onClick={() => { swapFlower(FLOWERS.supervisorEnter); setTimeout(handleSupervisorLogin, 520); }}
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
          </AnimatedPanel>
        )}
      </div>
    </div>
  );
}
