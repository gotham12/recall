import { useState, useEffect } from 'react';
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
            <div className="dash-login__hero-illustration" aria-hidden>
              <svg viewBox="0 0 280 160" xmlns="http://www.w3.org/2000/svg" className="dash-login__hero-svg">
                {/* Sky gradient */}
                <defs>
                  <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E8F4FD" />
                    <stop offset="100%" stopColor="#FFF8F0" />
                  </linearGradient>
                  <linearGradient id="grassGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#86EFAC" />
                    <stop offset="100%" stopColor="#4ADE80" />
                  </linearGradient>
                  <linearGradient id="houseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FBBF24" />
                    <stop offset="100%" stopColor="#F59E0B" />
                  </linearGradient>
                </defs>
                <rect width="280" height="160" fill="url(#skyGrad)" />
                {/* Sun */}
                <circle cx="230" cy="36" r="22" fill="#FDE68A" opacity="0.9"/>
                <circle cx="230" cy="36" r="15" fill="#FCD34D"/>
                {/* Clouds */}
                <ellipse cx="60" cy="30" rx="28" ry="13" fill="#fff" opacity="0.85"/>
                <ellipse cx="80" cy="25" rx="22" ry="11" fill="#fff" opacity="0.9"/>
                <ellipse cx="45" cy="28" rx="18" ry="10" fill="#fff" opacity="0.8"/>
                <ellipse cx="170" cy="42" rx="20" ry="10" fill="#fff" opacity="0.75"/>
                <ellipse cx="185" cy="38" rx="16" ry="9" fill="#fff" opacity="0.8"/>
                {/* Grass */}
                <rect x="0" y="112" width="280" height="48" fill="url(#grassGrad)" rx="6"/>
                {/* House */}
                <rect x="90" y="70" width="100" height="50" fill="url(#houseGrad)" rx="4"/>
                {/* Roof */}
                <polygon points="78,72 140,30 202,72" fill="#EF4444" opacity="0.9"/>
                {/* Door */}
                <rect x="127" y="95" width="26" height="25" rx="3" fill="#92400E"/>
                <circle cx="148" cy="109" r="2.5" fill="#FCD34D"/>
                {/* Windows */}
                <rect x="98" y="80" width="22" height="18" rx="3" fill="#BAE6FD"/>
                <line x1="109" y1="80" x2="109" y2="98" stroke="#fff" strokeWidth="1.5" opacity="0.6"/>
                <line x1="98" y1="89" x2="120" y2="89" stroke="#fff" strokeWidth="1.5" opacity="0.6"/>
                <rect x="160" y="80" width="22" height="18" rx="3" fill="#BAE6FD"/>
                <line x1="171" y1="80" x2="171" y2="98" stroke="#fff" strokeWidth="1.5" opacity="0.6"/>
                <line x1="160" y1="89" x2="182" y2="89" stroke="#fff" strokeWidth="1.5" opacity="0.6"/>
                {/* Tree left */}
                <rect x="44" y="95" width="8" height="20" rx="2" fill="#78350F"/>
                <circle cx="48" cy="82" r="20" fill="#22C55E" opacity="0.85"/>
                <circle cx="48" cy="78" r="14" fill="#16A34A"/>
                {/* Tree right */}
                <rect x="230" y="98" width="8" height="17" rx="2" fill="#78350F"/>
                <circle cx="234" cy="86" r="17" fill="#22C55E" opacity="0.85"/>
                <circle cx="234" cy="82" r="12" fill="#16A34A"/>
                {/* Flowers in grass */}
                <circle cx="20" cy="116" r="4" fill="#F9A8D4"/>
                <circle cx="20" cy="116" r="2" fill="#FDE68A"/>
                <circle cx="260" cy="118" r="4" fill="#C4B5FD"/>
                <circle cx="260" cy="118" r="2" fill="#FDE68A"/>
                <circle cx="75" cy="118" r="3" fill="#FCA5A5"/>
                <circle cx="75" cy="118" r="1.5" fill="#FDE68A"/>
                {/* Heart */}
                <path d="M133 50 C133 47 136 45 140 49 C144 45 147 47 147 50 C147 54 140 60 140 60 C140 60 133 54 133 50Z" fill="#FF2D55" opacity="0.9"/>
              </svg>
            </div>
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
