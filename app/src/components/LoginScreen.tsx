import { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAppStore } from '../store/appStore';
import { db, type User } from '../db/db';
import { seedIfEmpty } from '../db/seed';
import { checkSupervisorAuth } from '../lib/auth';
import { loadUserSession } from '../lib/session';
import StudioIcon from './StudioIcon';
import OnboardingWizard from './OnboardingWizard';


type Role = 'patient' | 'supervisor' | null;

export default function LoginScreen() {
  const { setScreen } = useAppStore();
  const [role, setRole] = useState<Role>(null);
  const [selectedPatient, setSelectedPatient] = useState<User | null>(null);
  const [password, setPassword] = useState('');
  const [supervisorPatient, setSupervisorPatient] = useState<User | null>(null);
  const [error, setError] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [patientPin, setPatientPin] = useState('');
  const [pinError, setPinError] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const stepRef = useRef<HTMLDivElement>(null);

  const patients = useLiveQuery(() => db.users.toArray(), []) ?? [];

  // Entrance animation
  useEffect(() => {
    void seedIfEmpty();
    if (!containerRef.current) return;
    const tl = gsap.timeline();
    tl.from('.dash-login__brand', { y: -28, opacity: 0, duration: 0.7, ease: 'power3.out' });
    tl.from('.dash-login__card', { y: 40, opacity: 0, duration: 0.6, ease: 'back.out(1.6)' }, 0.15);
    tl.from('.dash-btn', { y: 16, opacity: 0, duration: 0.45, stagger: 0.07, ease: 'power2.out' }, 0.35);
  }, []);

  // Step change animation (when role/patient changes)
  const animateStepIn = () => {
    if (!stepRef.current) return;
    gsap.fromTo(stepRef.current,
      { x: 40, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.32, ease: 'power3.out' }
    );
    gsap.from(stepRef.current.querySelectorAll('.dash-btn, .dash-input'),
      { y: 12, opacity: 0, duration: 0.32, stagger: 0.06, ease: 'power2.out', delay: 0.08 }
    );
  };

  const enterApp = (target: 'patient' | 'supervisor') => setScreen(target);

  const handlePatientLogin = async (patient: User) => {
    await seedIfEmpty();
    await loadUserSession(patient);
    enterApp('patient');
  };

  const handleSupervisorLogin = async () => {
    const auth = checkSupervisorAuth(password);
    if (!auth.ok) { setError(auth.error ?? 'Incorrect password.'); return; }
    if (!supervisorPatient) { setError('Please select a patient.'); return; }
    setError('');
    await seedIfEmpty();
    await loadUserSession(supervisorPatient);
    enterApp('supervisor');
  };

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
    <div ref={containerRef} className="dash-login">
      {/* Brand */}
      <div className="dash-login__brand">
        <img src="/logo.png" alt="Recall logo" className="dash-login__logo-img" />
        <h1 className="dash-login__wordmark">Recall</h1>
        <p className="dash-login__tagline">Memory · Medication · Moments</p>
      </div>

      {/* Card */}
      <div className="dash-login__card">
        {role === null && (
          <div ref={stepRef} className="dash-login__step">
            <p className="dash-login__eyebrow">Welcome back</p>
            <p className="dash-login__title">Who's using Recall?</p>
            <div className="dash-login__actions">
              <button className="dash-btn dash-btn--primary" onClick={() => { setRole('patient'); setTimeout(animateStepIn, 10); }}>
                <span className="dash-btn__icon-wrap dash-btn__icon-wrap--amber"><StudioIcon name="user" size={20} /></span>
                <span className="dash-btn__body">
                  <span className="dash-btn__label">Patient</span>
                  <span className="dash-btn__hint">Daily care & reminders</span>
                </span>
              </button>
              <button className="dash-btn dash-btn--secondary" onClick={() => { setRole('supervisor'); setTimeout(animateStepIn, 10); }}>
                <span className="dash-btn__icon-wrap dash-btn__icon-wrap--teal"><StudioIcon name="profile" size={20} /></span>
                <span className="dash-btn__body">
                  <span className="dash-btn__label">Supervisor</span>
                  <span className="dash-btn__hint">Caregiver dashboard</span>
                </span>
              </button>
            </div>
          </div>
        )}

        {role === 'patient' && !selectedPatient && (
          <div className="dash-login__step">
            <button className="dash-back" onClick={() => setRole(null)}>← Back</button>
            <p className="dash-login__eyebrow">Patient</p>
            <p className="dash-login__title">Who are you today?</p>
            <div className="dash-login__actions">
              {patients.map((p) => (
                <button key={p.id} className="dash-btn dash-btn--user" onClick={() => setSelectedPatient(p)}>
                  <span className="dash-btn__avatar">{p.name.split(' ').map(n => n[0]).join('').slice(0,2)}</span>
                  <span className="dash-btn__body">
                    <span className="dash-btn__label">{p.name}</span>
                    <span className="dash-btn__hint">{p.city}</span>
                  </span>
                </button>
              ))}
              <button className="dash-btn dash-btn--ghost" onClick={() => setShowOnboarding(true)}>
                <span className="dash-btn__body"><span className="dash-btn__label">+ Set up new profile</span></span>
              </button>
            </div>
          </div>
        )}

        {role === 'patient' && selectedPatient && (
          <div className="dash-login__step">
            <button className="dash-back" onClick={() => { setSelectedPatient(null); setPatientPin(''); setPinError(''); }}>← Back</button>
            <p className="dash-login__eyebrow">Patient</p>
            <p className="dash-login__title">Welcome back,<br />{selectedPatient.name.split(' ')[0]}</p>
            <div className="dash-login__actions">
              {selectedPatient.patientPin && (
                <input type="password" inputMode="numeric" maxLength={4} value={patientPin}
                  onChange={e => { setPatientPin(e.target.value.replace(/\D/g,'')); setPinError(''); }}
                  placeholder="Enter PIN" className="dash-input" autoFocus />
              )}
              {pinError && <p className="dash-error">{pinError}</p>}
              <button className="dash-btn dash-btn--primary" onClick={() => {
                if (selectedPatient.patientPin && patientPin !== selectedPatient.patientPin) { setPinError('Incorrect PIN.'); return; }
                handlePatientLogin(selectedPatient);
              }}>
                <span className="dash-btn__body"><span className="dash-btn__label">Enter Dashboard</span></span>
              </button>
            </div>
          </div>
        )}

        {role === 'supervisor' && !supervisorPatient && (
          <div className="dash-login__step">
            <button className="dash-back" onClick={() => setRole(null)}>← Back</button>
            <p className="dash-login__eyebrow">Supervisor</p>
            <p className="dash-login__title">Who are you caring for?</p>
            <div className="dash-login__actions">
              {patients.map((p) => (
                <button key={p.id} className="dash-btn dash-btn--user" onClick={() => setSupervisorPatient(p)}>
                  <span className="dash-btn__avatar">{p.name.split(' ').map(n => n[0]).join('').slice(0,2)}</span>
                  <span className="dash-btn__body">
                    <span className="dash-btn__label">{p.name}</span>
                    <span className="dash-btn__hint">{p.city}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {role === 'supervisor' && supervisorPatient && (
          <div className="dash-login__step">
            <button className="dash-back" onClick={() => { setSupervisorPatient(null); setPassword(''); setError(''); }}>← Back</button>
            <p className="dash-login__eyebrow">Supervisor</p>
            <p className="dash-login__title">Signing in for {supervisorPatient.name.split(' ')[0]}</p>
            <div className="dash-login__actions">
              <input type="password" value={password} onChange={e => { setPassword(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleSupervisorLogin()}
                placeholder="Password" className="dash-input" autoFocus />
              {error && <p className="dash-error">{error}</p>}
              <button className="dash-btn dash-btn--primary" onClick={handleSupervisorLogin}>
                <span className="dash-btn__body"><span className="dash-btn__label">Sign In</span></span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
