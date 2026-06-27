import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { gsap } from 'gsap';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAppStore } from '../store/appStore';
import { db, type User } from '../db/db';
import { seedIfEmpty } from '../db/seed';
import { checkSupervisorAuth } from '../lib/auth';
import { loadUserSession } from '../lib/session';
import { photoForContact } from '../lib/safetyContacts';
import StudioIcon from './StudioIcon';
import OnboardingWizard from './OnboardingWizard';

type Role = 'patient' | 'supervisor' | null;

type LoginStep =
  | 'welcome'
  | 'patient-list'
  | 'patient-pin'
  | 'supervisor-list'
  | 'supervisor-auth';

function patientPhoto(user: User): string | undefined {
  return photoForContact(user.name) ?? user.familyPhotoUrl ?? undefined;
}

function initials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

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
  const cardRef = useRef<HTMLDivElement>(null);
  const stepRef = useRef<HTMLDivElement>(null);

  const patients = useLiveQuery(() => db.users.toArray(), []) ?? [];

  const step: LoginStep = useMemo(() => {
    if (role === null) return 'welcome';
    if (role === 'patient') {
      if (!selectedPatient) return 'patient-list';
      return 'patient-pin';
    }
    if (!supervisorPatient) return 'supervisor-list';
    return 'supervisor-auth';
  }, [role, selectedPatient, supervisorPatient]);

  useEffect(() => {
    void seedIfEmpty();
    if (!containerRef.current) return;
    gsap.from(cardRef.current, { y: 24, opacity: 0, duration: 0.55, ease: 'power3.out' });
  }, []);

  const animateStepIn = useCallback(() => {
    if (!stepRef.current) return;
    gsap.fromTo(
      stepRef.current,
      { x: 36, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.38, ease: 'power3.out' }
    );
    gsap.from(stepRef.current.querySelectorAll('.dash-login__step-body > *, .dash-btn, .dash-input'),
      { y: 14, opacity: 0, duration: 0.34, stagger: 0.06, ease: 'power2.out', delay: 0.06 }
    );
  }, []);

  useEffect(() => {
    animateStepIn();
  }, [step, animateStepIn]);

  const pulseButton = (el: HTMLElement) => {
    gsap.fromTo(el, { scale: 0.96 }, { scale: 1, duration: 0.28, ease: 'back.out(2.5)' });
  };

  const transitionTo = (action: () => void, clickedEl?: HTMLElement | null) => {
    if (clickedEl) pulseButton(clickedEl);
    const node = stepRef.current;
    if (!node) {
      action();
      return;
    }
    gsap.killTweensOf(node);
    gsap.to(node, {
      x: -28,
      opacity: 0,
      duration: 0.22,
      ease: 'power2.in',
      onComplete: () => {
        action();
        gsap.set(node, { x: 32, opacity: 0 });
        animateStepIn();
      },
    });
  };

  const enterApp = (target: 'patient' | 'supervisor') => {
    if (!containerRef.current) {
      setScreen(target);
      return;
    }
    gsap.to(containerRef.current, {
      y: -24,
      opacity: 0,
      scale: 0.98,
      duration: 0.5,
      ease: 'power2.inOut',
      onComplete: () => setScreen(target),
    });
  };

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
      <div ref={cardRef} className="dash-login__card">
        <div className="dash-login__brand">
          <img src="/recall/logo.png" alt="Recall" className="dash-login__logo-img" />
          <h1 className="dash-login__wordmark">Recall</h1>
          <p className="dash-login__tagline">Memory · Medication · Moments</p>
        </div>

        <div ref={stepRef} className="dash-login__step">
          <div className="dash-login__step-body">
            {step === 'welcome' && (
              <>
                <p className="dash-login__title">Who&apos;s using Recall?</p>
                <p className="dash-login__subtitle">Choose how you&apos;d like to sign in today.</p>
              </>
            )}

            {step === 'patient-list' && (
              <>
                <button type="button" className="dash-back" onClick={() => transitionTo(() => setRole(null))}>← Back</button>
                <p className="dash-login__title">Who are you today?</p>
                <p className="dash-login__subtitle">Tap your name to continue.</p>
              </>
            )}

            {step === 'patient-pin' && selectedPatient && (
              <>
                <button
                  type="button"
                  className="dash-back"
                  onClick={() => transitionTo(() => { setSelectedPatient(null); setPatientPin(''); setPinError(''); })}
                >
                  ← Back
                </button>
                <p className="dash-login__title">Welcome back,<br />{selectedPatient.name.split(' ')[0]}</p>
                {selectedPatient.patientPin && (
                  <>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={patientPin}
                      onChange={(e) => { setPatientPin(e.target.value.replace(/\D/g, '')); setPinError(''); }}
                      placeholder="Enter PIN"
                      className="dash-input"
                      autoFocus
                    />
                    {pinError && <p className="dash-error">{pinError}</p>}
                  </>
                )}
              </>
            )}

            {step === 'supervisor-list' && (
              <>
                <button type="button" className="dash-back" onClick={() => transitionTo(() => setRole(null))}>← Back</button>
                <p className="dash-login__title">Who are you caring for?</p>
                <p className="dash-login__subtitle">Select the patient you&apos;re monitoring today.</p>
              </>
            )}

            {step === 'supervisor-auth' && supervisorPatient && (
              <>
                <button
                  type="button"
                  className="dash-back"
                  onClick={() => transitionTo(() => { setSupervisorPatient(null); setPassword(''); setError(''); })}
                >
                  ← Back
                </button>
                <p className="dash-login__title">Signing in for {supervisorPatient.name.split(' ')[0]}</p>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSupervisorLogin()}
                  placeholder="Password"
                  className="dash-input"
                  autoFocus
                />
                {error && <p className="dash-error">{error}</p>}
                <p className="dash-login__demo-hint">
                  Demo password: <strong>care2026</strong>
                </p>
              </>
            )}

            {(step === 'patient-list' || step === 'supervisor-list') && (
              <div className="dash-login__user-list">
                {patients.map((p) => {
                  const photo = patientPhoto(p);
                  const isPatient = step === 'patient-list';
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className="dash-btn dash-btn--user"
                      onClick={(e) => transitionTo(
                        () => (isPatient ? setSelectedPatient(p) : setSupervisorPatient(p)),
                        e.currentTarget
                      )}
                    >
                      {photo ? (
                        <img src={photo} alt="" className="dash-btn__photo" />
                      ) : (
                        <span className="dash-btn__avatar">{initials(p.name)}</span>
                      )}
                      <span className="dash-btn__body">
                        <span className="dash-btn__label">{p.name}</span>
                        <span className="dash-btn__hint">{p.city}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="dash-login__actions">
            {step === 'welcome' && (
              <>
                <button
                  type="button"
                  className="dash-btn dash-btn--primary"
                  onClick={(e) => transitionTo(() => setRole('patient'), e.currentTarget)}
                >
                  <span className="dash-btn__icon-wrap dash-btn__icon-wrap--amber"><StudioIcon name="user" size={20} /></span>
                  <span className="dash-btn__body">
                    <span className="dash-btn__label">Patient</span>
                    <span className="dash-btn__hint">Daily care &amp; reminders</span>
                  </span>
                </button>
                <button
                  type="button"
                  className="dash-btn dash-btn--secondary"
                  onClick={(e) => transitionTo(() => setRole('supervisor'), e.currentTarget)}
                >
                  <span className="dash-btn__icon-wrap dash-btn__icon-wrap--teal"><StudioIcon name="profile" size={20} /></span>
                  <span className="dash-btn__body">
                    <span className="dash-btn__label">Supervisor</span>
                    <span className="dash-btn__hint">Caregiver dashboard</span>
                  </span>
                </button>
              </>
            )}

            {step === 'patient-list' && (
              <button type="button" className="dash-btn dash-btn--ghost" onClick={() => setShowOnboarding(true)}>
                <span className="dash-btn__body"><span className="dash-btn__label">+ Set up new profile</span></span>
              </button>
            )}

            {step === 'patient-pin' && selectedPatient && (
              <button
                type="button"
                className="dash-btn dash-btn--primary dash-btn--cta"
                onClick={(e) => {
                  if (selectedPatient.patientPin && patientPin !== selectedPatient.patientPin) {
                    setPinError('Incorrect PIN.');
                    gsap.fromTo(e.currentTarget, { x: -6 }, { x: 0, duration: 0.08, repeat: 3, yoyo: true });
                    return;
                  }
                  pulseButton(e.currentTarget);
                  void handlePatientLogin(selectedPatient);
                }}
              >
                <span className="dash-btn__body"><span className="dash-btn__label">Enter Dashboard</span></span>
              </button>
            )}

            {step === 'supervisor-auth' && supervisorPatient && (
              <button
                type="button"
                className="dash-btn dash-btn--primary dash-btn--cta"
                onClick={(e) => {
                  pulseButton(e.currentTarget);
                  void handleSupervisorLogin();
                }}
              >
                <span className="dash-btn__body"><span className="dash-btn__label">Sign In</span></span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
