import { useState, useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAppStore } from '../store/appStore';
import { useACSE } from '../hooks/useACSE';
import { db, type Event, type Medication, type User } from '../db/db';
import { isMedicationDueSoon } from '../lib/schedule';
import VoiceAgent from '../components/VoiceAgent';
import MedTracker from '../components/MedTracker';
import ACSEDashboard from '../components/ACSEDashboard';
import StateReconCard from '../components/StateReconCard';
import WhereAmICard from '../components/WhereAmICard';
import FamiliarFaces from '../components/FamiliarFaces';
import SafetyCircle from '../components/SafetyCircle';
import SettingsSheet from '../components/SettingsSheet';
import MemoryPhotoRecap from '../components/MemoryPhotoRecap';
import RoutineChecklist from '../components/RoutineChecklist';
import GameHub from '../components/games/GameHub';
import GoldenPathDemo from '../components/GoldenPathDemo';
import StudioIcon from '../components/StudioIcon';

// ─── Types ─────────────────────────────────────────────────────────────────
type PatientTab = 'today' | 'care' | 'mind' | 'routine';

const PANEL_TITLES: Record<string, string> = {
  voice: 'Clara',
  meds: 'Medications',
  games: 'Mind Games',
  memory: 'Memory',
  safety: 'Safety Circle',
  faces: 'Familiar Faces',
  events: 'Today\'s Events',
};

// ─── Tab bar icons ──────────────────────────────────────────────────────────
function IcoToday() {
  return <svg viewBox="0 0 24 24" fill="none" width="26" height="26"><rect x="3" y="4" width="18" height="17" rx="3.5" stroke="currentColor" strokeWidth="1.7"/><line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" strokeWidth="1.7"/><line x1="8" y1="2.5" x2="8" y2="5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><line x1="16" y1="2.5" x2="16" y2="5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><circle cx="12" cy="15" r="1.2" fill="currentColor"/></svg>;
}
function IcoCare() {
  return <svg viewBox="0 0 24 24" fill="none" width="26" height="26"><path d="M12 21s-7-5-7-10.5A5.5 5.5 0 0 1 12 5.5 5.5 5.5 0 0 1 19 10.5C19 16 12 21 12 21z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function IcoMind() {
  return <svg viewBox="0 0 24 24" fill="none" width="26" height="26"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7"/><path d="M9 12c0-1.65 1.34-3 3-3s3 1.35 3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><line x1="12" y1="15" x2="12" y2="17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>;
}
function IcoRoutine() {
  return <svg viewBox="0 0 24 24" fill="none" width="26" height="26"><path d="M5 12l4 4 10-9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

// ─── App shell components ───────────────────────────────────────────────────
function AppHeader({ name, acseScore, onSettings, onSwitch }: {
  name: string; acseScore: number; onSettings: () => void; onSwitch: () => void;
}) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return (
    <header className="app-header">
      <div>
        <p className="app-header__eyebrow">{greeting}</p>
        <h1 className="app-header__name">{name}</h1>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="app-header__score-pill" title="Cognitive score">
          <span className="app-header__score-dot" style={{
            background: acseScore >= 80 ? '#34C759' : acseScore >= 60 ? '#FF9500' : '#FF3B30'
          }} />
          {acseScore}
        </div>
        <button className="app-header__avatar tap-feedback" onClick={onSwitch} title="Switch user">
          {name.charAt(0).toUpperCase()}
        </button>
      </div>
    </header>
  );
}

function AppTabBar({ active, onChange }: { active: PatientTab; onChange: (t: PatientTab) => void }) {
  const tabs: { id: PatientTab; label: string; icon: JSX.Element }[] = [
    { id: 'today',   label: 'Today',   icon: <IcoToday /> },
    { id: 'care',    label: 'Care',    icon: <IcoCare /> },
    { id: 'mind',    label: 'Mind',    icon: <IcoMind /> },
    { id: 'routine', label: 'Routine', icon: <IcoRoutine /> },
  ];
  return (
    <nav className="app-tab-bar">
      {tabs.map(t => (
        <button key={t.id} className={`app-tab${active === t.id ? ' app-tab--active' : ''}`}
          onClick={() => onChange(t.id)} aria-label={t.label}>
          <span className="app-tab__icon">{t.icon}</span>
          <span className="app-tab__label">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

// ─── Panel (full-screen slide-over) ────────────────────────────────────────
function Panel({ id, panelRef, onClose, user }: {
  id: string; panelRef: React.RefObject<HTMLDivElement>;
  onClose: () => void; user: User | null;
}) {
  const { triggerMemoryRecap } = useAppStore();
  return (
    <div ref={panelRef} className="app-panel">
      <div className="app-panel-header">
        <button className="app-back-btn" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>
        <span className="app-panel-title">{PANEL_TITLES[id] ?? id}</span>
        <div style={{ width: 60 }} />
      </div>
      <div className="app-panel-content">
        {id === 'voice'  && <VoiceAgent />}
        {id === 'meds'   && <MedTracker />}
        {id === 'games'  && <GameHub />}
        {id === 'memory' && (
          <div className="panel-scroll-inner">
            <StateReconCard />
            <WhereAmICard />
            <ACSEDashboard />
            <button className="panel-primary-btn tap-feedback" onClick={() => triggerMemoryRecap('manual')}>
              Start memory recap
            </button>
          </div>
        )}
        {id === 'safety' && <div className="panel-scroll-inner"><SafetyCircle /></div>}
        {id === 'faces'  && <div className="panel-scroll-inner"><FamiliarFaces /></div>}
      </div>
    </div>
  );
}

// ─── Today tab ──────────────────────────────────────────────────────────────
function TodayTab({ events, medications, acseScore, onOpen }: {
  events: Event[];
  medications: Medication[];
  acseScore: number;
  onOpen: (id: string) => void;
}) {
  const now = new Date();
  const dueMeds = medications.filter(m => isMedicationDueSoon(m.schedule));
  const upcoming = events
    .filter(e => !e.completed && new Date(e.timestamp) > now)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(0, 4);

  const scoreColor = acseScore >= 80 ? '#34C759' : acseScore >= 60 ? '#FF9500' : '#FF3B30';
  const dateStr = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="tab-scroll">
      {/* Date header */}
      <div className="tab-date-header">{dateStr}</div>

      {/* Cognitive score card */}
      <section className="app-section">
        <h2 className="app-section-title">Cognitive Health</h2>
        <div className="app-card score-card" onClick={() => onOpen('memory')}>
          <div className="score-card__ring-wrap">
            <svg viewBox="0 0 56 56" width="56" height="56">
              <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(60,60,67,0.10)" strokeWidth="5"/>
              <circle cx="28" cy="28" r="22" fill="none" stroke={scoreColor} strokeWidth="5"
                strokeDasharray={`${(acseScore / 100) * 138.2} 138.2`}
                strokeLinecap="round" transform="rotate(-90 28 28)"/>
            </svg>
            <span className="score-card__number" style={{ color: scoreColor }}>{acseScore}</span>
          </div>
          <div className="score-card__text">
            <p className="score-card__label">ACSE Score</p>
            <p className="score-card__sublabel">
              {acseScore >= 80 ? 'Looking great today' : acseScore >= 60 ? 'Moderate — keep going' : 'Needs attention'}
            </p>
          </div>
          <svg viewBox="0 0 24 24" fill="none" width="18" height="18" style={{ color: 'rgba(60,60,67,0.30)', flexShrink: 0 }}>
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
      </section>

      {/* Medications */}
      <section className="app-section">
        <h2 className="app-section-title">Medications</h2>
        <div className="app-card-group">
          {dueMeds.length === 0 ? (
            <div className="app-card-row app-card-row--single">
              <span className="row-icon row-icon--green"><svg viewBox="0 0 24 24" fill="none" width="18" height="18"><path d="M5 12l4 4 10-9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
              <span className="row-text">All medications up to date</span>
            </div>
          ) : (
            dueMeds.slice(0, 3).map(med => (
              <div key={med.name} className="app-card-row" onClick={() => onOpen('meds')}>
                <span className="row-icon row-icon--orange"><svg viewBox="0 0 24 24" fill="none" width="18" height="18"><rect x="4" y="10" width="16" height="8" rx="4" stroke="currentColor" strokeWidth="1.8"/><line x1="8" y1="14" x2="10" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="9" y1="13" x2="9" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></span>
                <span className="row-text">{med.name}</span>
                <span className="row-badge row-badge--orange">Due now</span>
              </div>
            ))
          )}
          <div className="app-card-row app-card-row--action" onClick={() => onOpen('meds')}>
            <span className="row-text">View all medications</span>
            <svg viewBox="0 0 24 24" fill="none" width="16" height="16" style={{ color: 'rgba(60,60,67,0.30)' }}><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </div>
        </div>
      </section>

      {/* Upcoming events */}
      <section className="app-section">
        <h2 className="app-section-title">Coming Up</h2>
        <div className="app-card-group">
          {upcoming.length === 0 ? (
            <div className="app-card-row app-card-row--single">
              <span className="row-text" style={{ color: 'rgba(60,60,67,0.45)' }}>Nothing scheduled — enjoy your day</span>
            </div>
          ) : (
            upcoming.map(ev => (
              <div key={ev.id} className="app-card-row">
                <span className="row-icon row-icon--blue"><svg viewBox="0 0 24 24" fill="none" width="18" height="18"><rect x="3" y="4" width="18" height="17" rx="3" stroke="currentColor" strokeWidth="1.7"/><line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" strokeWidth="1.7"/></svg></span>
                <span className="row-text">{ev.title}</span>
                <span className="row-time">{new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Quick actions */}
      <section className="app-section">
        <h2 className="app-section-title">Quick Actions</h2>
        <div className="quick-action-row">
          <button className="quick-action-btn quick-action-btn--blue tap-feedback" onClick={() => onOpen('voice')}>
            <svg viewBox="0 0 24 24" fill="none" width="22" height="22"><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.9"/><path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/><path d="M19 10c2 -2 2-5 0-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
            Talk to Clara
          </button>
          <button className="quick-action-btn quick-action-btn--red tap-feedback" onClick={() => onOpen('safety')}>
            <svg viewBox="0 0 24 24" fill="none" width="22" height="22"><path d="M12 3C12 3 4 7 4 13C4 17.4 8 21 12 21C16 21 20 17.4 20 13C20 7 12 3 12 3Z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round"/><line x1="12" y1="10" x2="12" y2="15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
            Safety
          </button>
        </div>
      </section>

      <div style={{ height: 24 }} />
    </div>
  );
}

// ─── Care tab ───────────────────────────────────────────────────────────────
function CareTab({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <div className="tab-scroll">
      <section className="app-section">
        <h2 className="app-section-title">Medications</h2>
        <div className="app-card-group">
          <div className="app-card-nav-row" onClick={() => onOpen('meds')}>
            <span className="nav-row-icon" style={{ background: '#FFF3E5' }}>
              <svg viewBox="0 0 24 24" fill="none" width="20" height="20" style={{ color: '#EA6C00' }}><rect x="4" y="10" width="16" height="8" rx="4" stroke="currentColor" strokeWidth="1.8"/><line x1="8" y1="14" x2="10" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="9" y1="13" x2="9" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </span>
            <div className="nav-row-body">
              <span className="nav-row-label">Medication Tracker</span>
              <span className="nav-row-sub">Log & track all medications</span>
            </div>
            <svg viewBox="0 0 24 24" fill="none" width="16" height="16" style={{ color: 'rgba(60,60,67,0.28)' }}><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </div>
        </div>
      </section>

      <section className="app-section">
        <h2 className="app-section-title">People</h2>
        <div className="app-card-group">
          <div className="app-card-nav-row" onClick={() => onOpen('faces')}>
            <span className="nav-row-icon" style={{ background: '#E5F6FB' }}>
              <svg viewBox="0 0 24 24" fill="none" width="20" height="20" style={{ color: '#0891B2' }}><circle cx="9" cy="8" r="4" stroke="currentColor" strokeWidth="1.7"/><circle cx="16" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.7"/><path d="M2 20c0-3.9 3.1-7 7-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><path d="M12 13c3.3 0 6 2.7 6 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
            </span>
            <div className="nav-row-body">
              <span className="nav-row-label">Familiar Faces</span>
              <span className="nav-row-sub">Friends and family</span>
            </div>
            <svg viewBox="0 0 24 24" fill="none" width="16" height="16" style={{ color: 'rgba(60,60,67,0.28)' }}><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </div>
          <div className="app-card-nav-row" onClick={() => onOpen('safety')}>
            <span className="nav-row-icon" style={{ background: '#FFEBEA' }}>
              <svg viewBox="0 0 24 24" fill="none" width="20" height="20" style={{ color: '#DC2626' }}><path d="M12 3C12 3 4 7 4 13C4 17.4 8 21 12 21C16 21 20 17.4 20 13C20 7 12 3 12 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><line x1="12" y1="10" x2="12" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </span>
            <div className="nav-row-body">
              <span className="nav-row-label">Safety Circle</span>
              <span className="nav-row-sub">Emergency contacts</span>
            </div>
            <svg viewBox="0 0 24 24" fill="none" width="16" height="16" style={{ color: 'rgba(60,60,67,0.28)' }}><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </div>
        </div>
      </section>
      <div style={{ height: 24 }} />
    </div>
  );
}

// ─── Mind tab ───────────────────────────────────────────────────────────────
function MindTab({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <div className="tab-scroll">
      {/* Clara — most prominent */}
      <section className="app-section">
        <h2 className="app-section-title">Your AI Companion</h2>
        <div className="clara-hero-card tap-feedback" onClick={() => onOpen('voice')}>
          <div className="clara-hero-card__icon">
            <svg viewBox="0 0 64 64" fill="none" width="48" height="48">
              <circle cx="32" cy="26" r="12" fill="white" fillOpacity="0.95"/>
              <path d="M10 58c0-12.2 9.8-22 22-22s22 9.8 22 22" fill="white" fillOpacity="0.88"/>
              <path d="M50 30c3-4 3-11 0-15" stroke="white" strokeOpacity="0.75" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="clara-hero-card__body">
            <p className="clara-hero-card__name">Clara</p>
            <p className="clara-hero-card__sub">Your AI memory companion</p>
          </div>
          <div className="clara-hero-card__cta">Talk now →</div>
        </div>
      </section>

      <section className="app-section">
        <h2 className="app-section-title">Activities</h2>
        <div className="app-card-group">
          <div className="app-card-nav-row" onClick={() => onOpen('games')}>
            <span className="nav-row-icon" style={{ background: '#F3EEFF' }}>
              <svg viewBox="0 0 24 24" fill="none" width="20" height="20" style={{ color: '#7C3AED' }}><rect x="2" y="2" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.8"/><rect x="14" y="2" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.8"/><rect x="2" y="14" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.8"/><rect x="14" y="14" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.8"/></svg>
            </span>
            <div className="nav-row-body">
              <span className="nav-row-label">Mind Games</span>
              <span className="nav-row-sub">Wordle, Sudoku & more</span>
            </div>
            <svg viewBox="0 0 24 24" fill="none" width="16" height="16" style={{ color: 'rgba(60,60,67,0.28)' }}><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </div>
          <div className="app-card-nav-row" onClick={() => onOpen('memory')}>
            <span className="nav-row-icon" style={{ background: '#FDE8F3' }}>
              <svg viewBox="0 0 24 24" fill="none" width="20" height="20" style={{ color: '#DB2777' }}><path d="M12 21s-8-5-8-12a7 7 0 0 1 8-5.9A7 7 0 0 1 20 9C20 16 12 21 12 21Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>
            </span>
            <div className="nav-row-body">
              <span className="nav-row-label">Memory</span>
              <span className="nav-row-sub">Cognitive dashboard & recap</span>
            </div>
            <svg viewBox="0 0 24 24" fill="none" width="16" height="16" style={{ color: 'rgba(60,60,67,0.28)' }}><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </div>
        </div>
      </section>
      <div style={{ height: 24 }} />
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────
export default function PatientView() {
  const [tab, setTab] = useState<PatientTab>('today');
  const [panel, setPanel] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { user, acseScore, demoMode, setDemoMode } = useAppStore();
  const { recordNavigation } = useACSE();
  const setScreen = useAppStore(s => s.setScreen);
  const panelRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  const events = useLiveQuery<Event[]>(
    () => user?.id ? db.events.where('userId').equals(user.id).sortBy('timestamp') : Promise.resolve([]),
    [user?.id]
  ) ?? [];

  const medications: Medication[] = user?.medications ?? [];

  const firstName = user?.name?.split(' ')[0] ?? 'there';

  // Panel slide in
  useEffect(() => {
    if (!panelRef.current || !panel) return;
    gsap.fromTo(panelRef.current,
      { x: '100%', opacity: 0.7 },
      { x: '0%', opacity: 1, duration: 0.34, ease: 'power3.out' }
    );
  }, [panel]);

  // Tab switch animation
  const handleTabChange = (t: PatientTab) => {
    if (t === tab) return;
    if (mainRef.current) {
      gsap.fromTo(mainRef.current, { opacity: 0.5, y: 8 }, { opacity: 1, y: 0, duration: 0.28, ease: 'power2.out' });
    }
    setTab(t);
    recordNavigation();
  };

  const openPanel = (id: string) => { recordNavigation(); setPanel(id); };
  const closePanel = () => {
    if (panelRef.current) {
      gsap.to(panelRef.current, { x: '100%', opacity: 0.7, duration: 0.26, ease: 'power2.in', onComplete: () => setPanel(null) });
    } else setPanel(null);
  };

  // Panel overlay
  if (panel) {
    return (
      <>
        <Panel id={panel} panelRef={panelRef} onClose={closePanel} user={user} />
        <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        <MemoryPhotoRecap />
      </>
    );
  }

  return (
    <div className="app-shell">
      <AppHeader
        name={firstName}
        acseScore={acseScore}
        onSettings={() => setSettingsOpen(true)}
        onSwitch={() => setScreen('login')}
      />

      <main ref={mainRef} className="app-main">
        {tab === 'today'   && <TodayTab events={events} medications={medications} acseScore={acseScore} onOpen={openPanel} />}
        {tab === 'care'    && <CareTab onOpen={openPanel} />}
        {tab === 'mind'    && <MindTab onOpen={openPanel} />}
        {tab === 'routine' && <div className="tab-scroll"><RoutineChecklist /></div>}
      </main>

      <AppTabBar active={tab} onChange={handleTabChange} />

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <MemoryPhotoRecap />
      {demoMode && (
        <GoldenPathDemo
          onNavigate={(id) => openPanel(id)}
          onClose={() => setDemoMode(false)}
        />
      )}
    </div>
  );
}

