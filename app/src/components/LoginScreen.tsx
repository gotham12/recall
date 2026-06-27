import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { gsap } from 'gsap';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAppStore } from '../store/appStore';
import { db, type User } from '../db/db';
import { seedIfEmpty } from '../db/seed';
import { checkSupervisorAuth } from '../lib/auth';
import { loadUserSession } from '../lib/session';
import { FAMILY_PHOTOS } from '../lib/assets';
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

const STEP_HERO: Record<LoginStep, { src: string; alt: string; caption?: string }> = {
  welcome: {
    src: `${import.meta.env.BASE_URL}logo.png`,
    alt: 'Recall',
    caption: 'Your memory companion',
  },
  'patient-list': {
    src: FAMILY_PHOTOS.susan,
    alt: 'Patient choosing profile',
    caption: 'Daily care made gentle',
  },
  'patient-pin': {
    src: FAMILY_PHOTOS.robert,
    alt: 'Welcome back',
    caption: 'Secure and familiar',
  },
  'supervisor-list': {
    src: FAMILY_PHOTOS.lily,
    alt: 'Caregiver dashboard',
    caption: 'Care with confidence',
  },
  'supervisor-auth': {
    src: FAMILY_PHOTOS.susan,
    alt: 'Supervisor sign in',
    caption: 'Protected caregiver access',
  },
};

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
  const heroRef = useRef<HTMLDivElement>(null);
  const heroImgRef = useRef<HTMLImageElement>(null);

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

  const hero = useMemo(() => {
    if (step === 'patient-pin' && selectedPatient) {
      const photo = patientPhoto(selectedPatient);
      return {
        src: photo ?? STEP_HERO['patient-pin'].src,
        alt: selectedPatient.name,
        caption: `Welcome back, ${selectedPatient.name.split(' ')[0]}`,
      };
    }
    if (step === 'supervisor-auth' && supervisorPatient) {
      const photo = patientPhoto(supervisorPatient);
      return {
        src: photo ?? STEP_HERO['supervisor-auth'].src,
        alt: supervisorPatient.name,
        caption: `Caring for ${supervisorPatient.name.split(' ')[0]}`,
      };
    }
    return STEP_HERO[step];
  }, [step, selectedPatient, supervisorPatient]);

  useEffect(() => {
    void seedIfEmpty();
    if (!containerRef.current) return;
    const tl = gsap.timeline();
    tl.from('.dash-login__brand', { y: -28, opacity: 0, duration: 0.7, ease: 'power3.out' });
    tl.from(cardRef.current, { y: 48, opacity: 0, scale: 0.96, duration: 0.65, ease: 'back.out(1.4)' }, 0.12);
    tl.from('.dash-login__hero', { scale: 1.08, opacity: 0, duration: 0.55, ease: 'power2.out' }, 0.2);
  }, []);

  const animateStepIn = useCallback(() => {
    if (!stepRef.current) return;
    gsap.fromTo(
      stepRef.current,
      { x: 36, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.38, ease: 'power3.out' }
    );
    gsap.from(stepRef.current.querySelectorAll('.dash-btn, .dash-input, .dash-login__subtitle'),
      { y: 14, opacity: 0, duration: 0.34, stagger: 0.07, ease: 'power2.out', delay: 0.06 }
    );
  }, []);

  const animateHeroSwap = useCallback(() => {
    if (!heroRef.current || !heroImgRef.current) return;
    gsap.fromTo(heroRef.current,
      { opacity: 0.4, scale: 0.97 },
      { opacity: 1, scale: 1, duration: 0.45, ease: 'power2.out' }
    );
    gsap.fromTo(heroImgRef.current,
      { scale: 1.12, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.55, ease: 'power3.out' }
    );
  }, []);

  useEffect(() => {
    animateHeroSwap();
    animateStepIn();
  }, [step, animateHeroSwap, animateStepIn]);

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
      <div className="dash-login__brand">
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Recall logo" className="dash-login__logo-img" />
        <h1 className="dash-login__wordmark">Recall</h1>
        <p className="dash-login__tagline">Memory · Medication · Moments</p>
      </div>

      <div ref={cardRef} className="dash-login__card">
        <div ref={heroRef} className="dash-login__hero">
          <div className="dash-login__hero-frame">
            <img
              ref={heroImgRef}
              key={hero.src}
              src={hero.src}
              alt={hero.alt}
              className="dash-login__hero-photo"
            />
            <div className="dash-login__hero-shade" />
            {hero.caption && <p className="dash-login__hero-caption">{hero.caption}</p>}
          </div>
          <div className="dash-login__step-dots" aria-hidden>
            {(['welcome', 'patient-list', 'supervisor-list'] as const).map((id) => (
              <span
                key={id}
                className={`dash-login__dot${step === id || (step === 'patient-pin' && id === 'patient-list') || (step === 'supervisor-auth' && id === 'supervisor-list') ? ' dash-login__dot--active' : ''}`}
              />
            ))}
          </div>
        </div>

        <div ref={stepRef} className="dash-login__step">
          {step === 'welcome' && (
            <>
              <p className="dash-login__eyebrow">Welcome back</p>
              <p className="dash-login__title">Who&apos;s using Recall?</p>
              <p className="dash-login__subtitle">Choose how you&apos;d like to sign in today.</p>
              <div className="dash-login__actions">
                <button
                  type="button"
                  className="dash-btn dash-btn--primary"
                  onClick={(e) => transitionTo(() => setRole('patient'), e.currentTarget)}
                >
                  <span className="dash-btn__icon-wrap dash-btn__icon-wrap--amber"><StudioIcon name="user" size={20} /></span>
                  <span className="dash-btn__body">
                    <span className="dash-btn__label">Patient</span>
                    <span className="dash-btn__hint">Daily care & reminders</span>
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
              </div>
            </>
          )}

          {step === 'patient-list' && (
            <>
              <button type="button" className="dash-back" onClick={() => transitionTo(() => setRole(null))}>← Back</button>
              <p className="dash-login__eyebrow">Patient</p>
              <p className="dash-login__title">Who are you today?</p>
              <p className="dash-login__subtitle">Tap your name to continue.</p>
              <div className="dash-login__actions">
                {patients.map((p) => {
                  const photo = patientPhoto(p);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className="dash-btn dash-btn--user"
                      onClick={(e) => transitionTo(() => setSelectedPatient(p), e.currentTarget)}
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
                <button type="button" className="dash-btn dash-btn--ghost" onClick={() => setShowOnboarding(true)}>
                  <span className="dash-btn__body"><span className="dash-btn__label">+ Set up new profile</span></span>
                </button>
              </div>
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
              <p className="dash-login__eyebrow">Patient</p>
              <p className="dash-login__title">Welcome back,<br />{selectedPatient.name.split(' ')[0]}</p>
              <p className="dash-login__subtitle">Enter your PIN to open your dashboard.</p>
              <div className="dash-login__actions">
                {selectedPatient.patientPin && (
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
                )}
                {pinError && <p className="dash-error">{pinError}</p>}
                <button
                  type="button"
                  className="dash-btn dash-btn--primary"
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
              </div>
            </>
          )}

          {step === 'supervisor-list' && (
            <>
              <button type="button" className="dash-back" onClick={() => transitionTo(() => setRole(null))}>← Back</button>
              <p className="dash-login__eyebrow">Supervisor</p>
              <p className="dash-login__title">Who are you caring for?</p>
              <p className="dash-login__subtitle">Select the patient you&apos;re monitoring today.</p>
              <div className="dash-login__actions">
                {patients.map((p) => {
                  const photo = patientPhoto(p);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className="dash-btn dash-btn--user"
                      onClick={(e) => transitionTo(() => setSupervisorPatient(p), e.currentTarget)}
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
              <p className="dash-login__eyebrow">Supervisor</p>
              <p className="dash-login__title">Signing in for {supervisorPatient.name.split(' ')[0]}</p>
              <p className="dash-login__subtitle">Enter your caregiver password to continue.</p>
              <div className="dash-login__actions">
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
                <button
                  type="button"
                  className="dash-btn dash-btn--primary"
                  onClick={(e) => {
                    pulseButton(e.currentTarget);
                    void handleSupervisorLogin();
                  }}
                >
                  <span className="dash-btn__body"><span className="dash-btn__label">Sign In</span></span>
                </button>
                <p className="dash-login__demo-hint">
                  Demo password: <strong>care2026</strong>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
