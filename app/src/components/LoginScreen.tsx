import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAppStore } from '../store/appStore';
import { db, type User } from '../db/db';
import { seedIfEmpty } from '../db/seed';
import { checkSupervisorAuth } from '../lib/auth';
import { loadUserSession } from '../lib/session';
import StudioIcon from './StudioIcon';
import OnboardingWizard from './OnboardingWizard';

function GlassOrbs({ small = false }: { small?: boolean }) {
  return (
    <div className={`lg-login-orbs ${small ? 'lg-login-orbs--small' : ''}`} aria-hidden>
      <div className="lg-login-orb lg-login-orb--1">
        <div className="lg-login-orb__shine" />
      </div>
      <div className="lg-login-orb lg-login-orb--2">
        <div className="lg-login-orb__shine" />
      </div>
      <div className="lg-login-orb lg-login-orb--3">
        <div className="lg-login-orb__shine" />
      </div>
    </div>
  );
}

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
  const [visible, setVisible] = useState(false);

  const patients = useLiveQuery(() => db.users.toArray(), []) ?? [];

  useEffect(() => {
    void seedIfEmpty();
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

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
    <div className="dash-login" style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(12px)', transition: 'opacity 0.5s ease, transform 0.5s ease' }}>
      {/* Brand */}
      <div className="dash-login__brand">
        <div className="dash-login__icon-wrap">
          <StudioIcon name="home" size={28} />
        </div>
        <h1 className="dash-login__wordmark">Recall</h1>
        <p className="dash-login__tagline">Memory · Medication · Moments</p>
      </div>

      {/* Card */}
      <div className="dash-login__card">
        {role === null && (
          <div className="dash-login__step">
            <p className="dash-login__eyebrow">Welcome back</p>
            <p className="dash-login__title">Who's using Recall?</p>
            <div className="dash-login__actions">
              <button className="dash-btn dash-btn--primary" onClick={() => { setRole('patient'); }}>
                <span className="dash-btn__icon-wrap dash-btn__icon-wrap--amber"><StudioIcon name="user" size={20} /></span>
                <span className="dash-btn__body">
                  <span className="dash-btn__label">Patient</span>
                  <span className="dash-btn__hint">Daily care & reminders</span>
                </span>
              </button>
              <button className="dash-btn dash-btn--secondary" onClick={() => { setRole('supervisor'); }}>
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
