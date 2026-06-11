import { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import FlowerStage from './FlowerStage';
import AnimatedPanel from './AnimatedPanel';
import RecallLogo from './RecallLogo';
import { getFlowers, type FlowerKey } from '../flowers';
import { useAppStore } from '../store/appStore';
import ThemeToggle from './ThemeToggle';
import { db, type User } from '../db/db';
import { seedIfEmpty } from '../db/seed';
import { duration, EASE } from '../lib/motion';
import { checkSupervisorAuth } from '../lib/auth';
import { loadUserSession } from '../lib/session';
import StudioIcon from './StudioIcon';
import OnboardingWizard from './OnboardingWizard';

type Role = 'patient' | 'supervisor' | null;

export default function LoginScreen() {
  const { setScreen, theme } = useAppStore();
  const flowers = getFlowers(theme);
  const [role, setRole] = useState<Role>(null);
  const [selectedPatient, setSelectedPatient] = useState<User | null>(null);
  const [flowerKey, setFlowerKey] = useState<FlowerKey>('landing');
  const flowerSrc = flowers[flowerKey];
  const [password, setPassword] = useState('');
  const [supervisorPatient, setSupervisorPatient] = useState<User | null>(null);
  const [error, setError] = useState('');
  const [transitioning, setTransitioning] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [patientPin, setPatientPin] = useState('');
  const [pinError, setPinError] = useState('');
  const screenRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const patients = useLiveQuery(() => db.users.toArray(), []) ?? [];

  const swapFlower = (key: FlowerKey) => setFlowerKey(key);

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
    swapFlower(target === 'patient' ? 'patientApp' : 'supervisorApp');
    setTimeout(() => {
      setScreen(target);
      setTransitioning(false);
    }, duration(1100, 50));
  };

  const handlePatientLogin = async (patient: User) => {
    await seedIfEmpty();
    await loadUserSession(patient);
    enterApp('patient');
  };

  const handleSupervisorLogin = async () => {
    const auth = checkSupervisorAuth(password);
    if (!auth.ok) {
      setError(auth.error ?? 'Incorrect password.');
      return;
    }
    if (!supervisorPatient) {
      setError('Please select a patient to monitor.');
      return;
    }
    setError('');
    await seedIfEmpty();
    await loadUserSession(supervisorPatient);
    enterApp('supervisor');
  };

  const loginStep =
    role === null ? 1 :
    role === 'patient' && !selectedPatient ? 2 :
    role === 'patient' && selectedPatient ? 3 :
    role === 'supervisor' && !supervisorPatient ? 2 :
    3;

  if (showOnboarding) {
    return (
      <OnboardingWizard
        onComplete={async (patient) => {
          setShowOnboarding(false);
          await loadUserSession(patient);
          enterApp('patient');
        }}
        onCancel={() => setShowOnboarding(false)}
      />
    );
  }

  return (
    <div ref={screenRef} className="studio-screen login-screen">
      <FlowerStage
        key={`${theme}-${flowerKey}`}
        src={flowerSrc}
        glowIntensity={0.45}
        variant="hero"
      />

      <div className="login-theme-toggle">
        <ThemeToggle />
      </div>

      <div className="login-top login-top--slim">
        <RecallLogo size="lg" />
        <p className="login-subtitle">Memory care for Margaret &amp; family</p>
      </div>

      <div ref={panelRef} className="login-panel login-panel--streamlined">
        {role !== null && (
          <div className="login-steps" aria-label={`Step ${loginStep} of 3`}>
            {[1, 2, 3].map((step) => (
              <span
                key={step}
                className={`login-steps__dot ${loginStep >= step ? 'login-steps__dot--active' : ''}`}
              />
            ))}
          </div>
        )}

        {role === null && (
          <AnimatedPanel panelKey="landing" stagger>
            <p className="login-greeting login-greeting--hero">Who&apos;s here today?</p>
            <div className="login-actions login-actions--role-select">
              <button
                className="studio-btn studio-btn--primary tap-feedback login-role-btn"
                onClick={() => { swapFlower('patient'); setRole('patient'); setSelectedPatient(null); }}
              >
                <span className="login-role-btn__icon"><StudioIcon name="user" size={22} /></span>
                <span className="studio-btn__label">Patient</span>
                <span className="studio-btn__hint">Daily care</span>
              </button>
              <button
                className="studio-btn studio-btn--ghost tap-feedback login-role-btn"
                onClick={() => { swapFlower('supervisor'); setRole('supervisor'); setSupervisorPatient(null); }}
              >
                <span className="login-role-btn__icon"><StudioIcon name="profile" size={22} /></span>
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
                  className="studio-btn studio-btn--primary tap-feedback login-patient-btn"
                  onClick={() => {
                    setSelectedPatient(p);
                    swapFlower('patient');
                  }}
                >
                  <span className="login-patient-btn__avatar">
                    {p.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                  </span>
                  <span className="login-patient-btn__text">
                    <span className="studio-btn__label">{p.name}</span>
                    <span className="studio-btn__hint">{p.city}</span>
                  </span>
                </button>
              ))}
              {patients.length === 0 && (
                <p className="studio-text-muted">Loading profiles…</p>
              )}
              <button
                className="studio-btn studio-btn--ghost tap-feedback"
                onClick={() => setShowOnboarding(true)}
              >
                <StudioIcon name="add" size={18} />
                <span className="studio-btn__label">Set up new profile</span>
              </button>
              <button
                className="studio-btn studio-btn--text"
                onClick={() => { swapFlower('landing'); setRole(null); }}
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
              {selectedPatient.patientPin && (
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={patientPin}
                  onChange={(e) => { setPatientPin(e.target.value.replace(/\D/g, '')); setPinError(''); }}
                  placeholder="Enter your PIN"
                  className="studio-input"
                  autoFocus
                />
              )}
              {pinError && <p className="studio-error">{pinError}</p>}
              <button
                className="studio-btn studio-btn--primary tap-feedback"
                onClick={() => {
                  if (selectedPatient.patientPin && patientPin !== selectedPatient.patientPin) {
                    setPinError('Incorrect PIN. Try again.');
                    return;
                  }
                  swapFlower('patientEnter');
                  setTimeout(() => handlePatientLogin(selectedPatient), 520);
                }}
              >
                <span className="studio-btn__label">Enter Dashboard</span>
              </button>
              <button
                className="studio-btn studio-btn--text"
                onClick={() => { setSelectedPatient(null); setPatientPin(''); setPinError(''); swapFlower('landing'); }}
              >
                Back
              </button>
            </div>
          </AnimatedPanel>
        )}

        {role === 'supervisor' && !supervisorPatient && (
          <AnimatedPanel panelKey="supervisor-patient" stagger>
            <p className="login-eyebrow">Supervisor</p>
            <p className="login-greeting">Who are you caring for?</p>
            <div className="login-actions login-actions--role-select">
              {patients.map((p) => (
                <button
                  key={p.id}
                  className="studio-btn studio-btn--primary tap-feedback login-patient-btn"
                  onClick={() => {
                    setSupervisorPatient(p);
                    swapFlower('supervisor');
                  }}
                >
                  <span className="login-patient-btn__avatar">
                    {p.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                  </span>
                  <span className="login-patient-btn__text">
                    <span className="studio-btn__label">{p.name}</span>
                    <span className="studio-btn__hint">{p.city}</span>
                  </span>
                </button>
              ))}
              <button
                className="studio-btn studio-btn--text"
                onClick={() => { swapFlower('landing'); setRole(null); }}
              >
                Back
              </button>
            </div>
          </AnimatedPanel>
        )}

        {role === 'supervisor' && supervisorPatient && (
          <AnimatedPanel panelKey="supervisor" stagger>
            <p className="login-eyebrow">Supervisor</p>
            <p className="login-greeting">Sign in for {supervisorPatient.name.split(' ')[0]}</p>
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
                onClick={() => { swapFlower('supervisorEnter'); setTimeout(handleSupervisorLogin, 520); }}
              >
                <span className="studio-btn__label">Sign In</span>
              </button>
              <button
                className="studio-btn studio-btn--text"
                onClick={() => { setSupervisorPatient(null); setPassword(''); setError(''); }}
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
