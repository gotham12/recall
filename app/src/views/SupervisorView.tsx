import { useState, useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import { useLiveQuery } from 'dexie-react-hooks';
import RoutineManager from '../components/RoutineManager';
import {
  ComposedChart, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ReferenceArea, Brush, Cell, Area, Line,
} from 'recharts';
import StudioIcon from '../components/StudioIcon';
import VitalsDashboard from '../components/VitalsDashboard';
import { addMedication, removeMedication, replaceMedication } from '../lib/medications';
import type { Medication } from '../db/db';
import StormRadar from '../components/StormRadar';
import CareJournal from '../components/CareJournal';
import ACSESignalAudit from '../components/supervisor/ACSESignalAudit';
import LiveActivityFeed from '../components/supervisor/LiveActivityFeed';
import MedicationAdherence from '../components/supervisor/MedicationAdherence';
import WeeklyInsights from '../components/supervisor/WeeklyInsights';
import { useAppStore } from '../store/appStore';
import SettingsSheet from '../components/SettingsSheet';
import { db, type Event, type User } from '../db/db';

type SupTab = 'overview' | 'schedule' | 'acse' | 'insights';

// ─── Tab bar icons ──────────────────────────────────────────────────────────
function IcoOverview() {
  return <svg viewBox="0 0 24 24" fill="none" width="26" height="26"><rect x="3" y="13" width="5" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.7"/><rect x="10" y="8" width="5" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.7"/><rect x="17" y="3" width="5" height="18" rx="1.5" stroke="currentColor" strokeWidth="1.7"/></svg>;
}
function IcoSchedule() {
  return <svg viewBox="0 0 24 24" fill="none" width="26" height="26"><rect x="3" y="4" width="18" height="17" rx="3" stroke="currentColor" strokeWidth="1.7"/><line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" strokeWidth="1.7"/><line x1="8" y1="2.5" x2="8" y2="5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><line x1="16" y1="2.5" x2="16" y2="5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>;
}
function IcoInsights() {
  return <svg viewBox="0 0 24 24" fill="none" width="26" height="26"><polyline points="3,17 8,11 13,14 18,6 21,9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/><circle cx="3" cy="17" r="1.5" fill="currentColor"/><circle cx="8" cy="11" r="1.5" fill="currentColor"/><circle cx="13" cy="14" r="1.5" fill="currentColor"/><circle cx="18" cy="6" r="1.5" fill="currentColor"/></svg>;
}
function IcoACSE() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="26" height="26">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M9 12c0-1.65 1.35-3 3-3s3 1.35 3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="12" y1="15" x2="12" y2="17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <circle cx="12" cy="19" r="1" fill="currentColor"/>
    </svg>
  );
}

// ─── App header ─────────────────────────────────────────────────────────────
function SupHeader({ patientName, supervisorName, acseScore, onSettings, onSwitch }: {
  patientName: string; supervisorName: string; acseScore: number; onSettings: () => void; onSwitch: () => void;
}) {
  const scoreColor = acseScore >= 80 ? '#34C759' : acseScore >= 60 ? '#FF9500' : '#FF3B30';
  const initials = supervisorName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'SV';
  return (
    <header className="app-header">
      <div>
        <p className="app-header__eyebrow">Caring for</p>
        <h1 className="app-header__name">{patientName}</h1>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="app-header__score-pill" title="ACSE score">
          <span className="app-header__score-dot" style={{ background: scoreColor }} />
          {acseScore}
        </div>
        <button className="app-header__avatar tap-feedback" onClick={onSwitch} title="Switch user"
          style={{ background: '#5856D6' }}>
          {initials}
        </button>
      </div>
    </header>
  );
}

// ─── Tab bar ────────────────────────────────────────────────────────────────
function SupTabBar({ active, onChange }: { active: SupTab; onChange: (t: SupTab) => void }) {
  const tabs: { id: SupTab; label: string; icon: JSX.Element }[] = [
    { id: 'overview',  label: 'Overview', icon: <IcoOverview /> },
    { id: 'schedule',  label: 'Schedule', icon: <IcoSchedule /> },
    { id: 'acse',      label: 'ACSE',     icon: <IcoACSE /> },
    { id: 'insights',  label: 'Insights', icon: <IcoInsights /> },
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

// ─── Panel ──────────────────────────────────────────────────────────────────
const SUP_PANEL_TITLES: Record<string, string> = {
  events: 'Alerts & Events',
  medications: 'Medications',
  routine: 'Routine Manager',
  journal: 'Care Journal',
  stats: 'Statistics',
};

// ─── Overview tab ───────────────────────────────────────────────────────────
function OverviewTab({ user, acseScore, onOpen, onComfortMode, comfortActive }: {
  user: User | null; acseScore: number; onOpen: (id: string) => void;
  onComfortMode: () => void; comfortActive: boolean;
}) {
  const scoreColor = acseScore >= 80 ? '#34C759' : acseScore >= 60 ? '#FF9500' : '#FF3B30';
  const eventCount = useLiveQuery<number>(
    () => user?.id ? db.events.where('userId').equals(user.id).count() : Promise.resolve(0),
    [user?.id]
  ) ?? 0;
  const medCount = useLiveQuery<number>(
    () => user?.id ? db.medicationLogs.where('userId').equals(user.id).count() : Promise.resolve(0),
    [user?.id]
  ) ?? 0;

  return (
    <div className="tab-scroll">
      {/* Comfort Mode CTA */}
      <section className="app-section">
        <button className="comfort-mode-btn tap-feedback" onClick={onComfortMode} disabled={comfortActive}>
          <div className="comfort-mode-btn__icon">
            <svg viewBox="0 0 24 24" fill="none" width="26" height="26">
              <path d="M12 2C8.5 2 5.5 4 4 7c-.5 1-.5 2-.5 3 0 5 4 9 8.5 12 4.5-3 8.5-7 8.5-12 0-1-.1-2-.5-3C18.5 4 15.5 2 12 2z" fill="rgba(255,255,255,0.25)" stroke="white" strokeWidth="1.8"/>
              <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="comfort-mode-btn__body">
            <p className="comfort-mode-btn__title">{comfortActive ? 'Comfort Mode Active' : 'Activate Comfort Mode'}</p>
            <p className="comfort-mode-btn__sub">Calming music, soothing visuals & gentle reminders</p>
          </div>
          <svg viewBox="0 0 24 24" fill="none" width="20" height="20" style={{ flexShrink: 0, opacity: 0.8 }}>
            <path d="M9 18l6-6-6-6" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
        </button>
      </section>

      {/* ACSE score */}
      <section className="app-section">
        <div className="sup-section-header">
          <div className="sup-section-dot" style={{ background: scoreColor }}/>
          <h2 className="app-section-title" style={{ margin: 0 }}>Cognitive Health</h2>
        </div>
        <div className="app-card score-card" onClick={() => onOpen('stats')} style={{ borderLeft: `3px solid ${scoreColor}`, cursor: 'pointer' }}>
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
              {acseScore >= 80 ? 'Patient is stable' : acseScore >= 60 ? 'Moderate — monitor closely' : 'Needs immediate attention'}
            </p>
          </div>
          <svg viewBox="0 0 24 24" fill="none" width="18" height="18" style={{ color: 'rgba(60,60,67,0.30)', flexShrink: 0 }}>
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
      </section>

      {/* Quick stats — colorful cards */}
      <section className="app-section">
        <div className="sup-section-header">
          <div className="sup-section-dot" style={{ background: '#007AFF' }}/>
          <h2 className="app-section-title" style={{ margin: 0 }}>Today at a Glance</h2>
        </div>
        <div className="stat-pair-row">
          <button className="sup-stat-card tap-feedback" onClick={() => onOpen('events')}
            style={{ background: 'rgba(0,122,255,0.08)', border: '1px solid rgba(0,122,255,0.15)', flex: 1 }}>
            <p className="sup-stat-card__value" style={{ color: '#007AFF' }}>{eventCount}</p>
            <p className="sup-stat-card__label" style={{ color: '#007AFF' }}>Events logged</p>
          </button>
          <button className="sup-stat-card tap-feedback" onClick={() => onOpen('medications')}
            style={{ background: 'rgba(234,108,0,0.08)', border: '1px solid rgba(234,108,0,0.15)', flex: 1 }}>
            <p className="sup-stat-card__value" style={{ color: '#EA6C00' }}>{medCount}</p>
            <p className="sup-stat-card__label" style={{ color: '#EA6C00' }}>Med logs</p>
          </button>
        </div>
      </section>

      {/* Patient info */}
      {user && (
        <section className="app-section">
          <div className="sup-section-header">
            <div className="sup-section-dot" style={{ background: '#5856D6' }}/>
            <h2 className="app-section-title" style={{ margin: 0 }}>Patient</h2>
          </div>
          <div className="app-card" style={{ padding: '16px 20px', borderLeft: '3px solid #5856D6' }}>
            <p style={{ fontWeight: 700, fontSize: 17, margin: '0 0 4px', color: '#1C1C1E' }}>{user.name}</p>
            <p style={{ fontSize: 14, color: 'rgba(60,60,67,0.55)', margin: '0 0 2px' }}>Age {user.age} · {user.city}</p>
            {user.caregiverName && <p style={{ fontSize: 14, color: 'rgba(60,60,67,0.55)', margin: 0 }}>
              Caregiver: {user.caregiverName}
            </p>}
          </div>
        </section>
      )}

      {/* Live activity */}
      <section className="app-section">
        <div className="sup-section-header">
          <div className="sup-section-dot" style={{ background: '#34C759' }}/>
          <h2 className="app-section-title" style={{ margin: 0 }}>Recent Activity</h2>
        </div>
        <div className="app-card" style={{ padding: '8px 0', borderLeft: '3px solid rgba(52,199,89,0.5)' }}>
          <LiveActivityFeed limit={5} />
        </div>
      </section>

      <div style={{ height: 24 }} />
    </div>
  );
}

// ─── Schedule tab ────────────────────────────────────────────────────────────
function ScheduleTab({ user, onOpen }: { user: User | null; onOpen: (id: string) => void }) {
  return (
    <div className="tab-scroll">
      <section className="app-section">
        <h2 className="app-section-title">Events & Alerts</h2>
        <div className="app-card-group">
          <div className="app-card-nav-row" onClick={() => onOpen('events')}>
            <span className="nav-row-icon" style={{ background: '#FFEBEA' }}>
              <svg viewBox="0 0 24 24" fill="none" width="20" height="20" style={{ color: '#DC2626' }}><path d="M4 14l8-11 8 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><rect x="4" y="14" width="16" height="6" rx="1" stroke="currentColor" strokeWidth="1.8"/></svg>
            </span>
            <div className="nav-row-body">
              <span className="nav-row-label">Alerts & Events</span>
              <span className="nav-row-sub">View, add and manage events</span>
            </div>
            <svg viewBox="0 0 24 24" fill="none" width="16" height="16" style={{ color: 'rgba(60,60,67,0.28)' }}><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </div>
        </div>
      </section>

      <section className="app-section">
        <h2 className="app-section-title">Medications</h2>
        <div className="app-card-group">
          <div className="app-card-nav-row" onClick={() => onOpen('medications')}>
            <span className="nav-row-icon" style={{ background: '#FFF3E5' }}>
              <svg viewBox="0 0 24 24" fill="none" width="20" height="20" style={{ color: '#EA6C00' }}><rect x="4" y="10" width="16" height="8" rx="4" stroke="currentColor" strokeWidth="1.8"/><line x1="8" y1="14" x2="10" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="9" y1="13" x2="9" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </span>
            <div className="nav-row-body">
              <span className="nav-row-label">Medication Plan</span>
              <span className="nav-row-sub">Add, edit and track meds</span>
            </div>
            <svg viewBox="0 0 24 24" fill="none" width="16" height="16" style={{ color: 'rgba(60,60,67,0.28)' }}><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </div>
          <div className="app-card-nav-row" onClick={() => onOpen('routine')}>
            <span className="nav-row-icon" style={{ background: '#EAFAF0' }}>
              <svg viewBox="0 0 24 24" fill="none" width="20" height="20" style={{ color: '#16A34A' }}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><line x1="12" y1="7" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="12" y1="12" x2="16" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </span>
            <div className="nav-row-body">
              <span className="nav-row-label">Routine Manager</span>
              <span className="nav-row-sub">Daily care schedule</span>
            </div>
            <svg viewBox="0 0 24 24" fill="none" width="16" height="16" style={{ color: 'rgba(60,60,67,0.28)' }}><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </div>
        </div>
      </section>

      {/* Storm radar inline */}
      <section className="app-section">
        <h2 className="app-section-title">Weather Awareness</h2>
        <div className="app-card" style={{ padding: '0 4px 4px' }}>
          <StormRadar userId={user?.id} />
        </div>
      </section>
      <div style={{ height: 24 }} />
    </div>
  );
}

// ─── Insights tab ────────────────────────────────────────────────────────────
function InsightsTab({ user, onOpen }: { user: User | null; onOpen: (id: string) => void }) {
  const { acseScore } = useAppStore();
  const scoreColor = acseScore >= 80 ? '#34C759' : acseScore >= 60 ? '#FF9500' : '#FF3B30';

  return (
    <div className="tab-scroll">
      {/* Quick analytics nav */}
      <section className="app-section">
        <div className="sup-section-header">
          <div className="sup-section-dot" style={{ background: '#7C3AED' }}/>
          <h2 className="app-section-title" style={{ margin: 0 }}>Analytics</h2>
        </div>
        <div className="app-card-group">
          <div className="app-card-nav-row" onClick={() => onOpen('stats')}>
            <span className="nav-row-icon" style={{ background: '#F3EEFF' }}>
              <svg viewBox="0 0 24 24" fill="none" width="20" height="20" style={{ color: '#7C3AED' }}><polyline points="3,17 8,11 13,14 18,6 21,9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </span>
            <div className="nav-row-body">
              <span className="nav-row-label">Full Statistics</span>
              <span className="nav-row-sub">ACSE charts, vitals, patterns</span>
            </div>
            <svg viewBox="0 0 24 24" fill="none" width="16" height="16" style={{ color: 'rgba(60,60,67,0.28)' }}><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </div>
          <div className="app-card-nav-row" onClick={() => onOpen('journal')}>
            <span className="nav-row-icon" style={{ background: '#E5F6FB' }}>
              <svg viewBox="0 0 24 24" fill="none" width="20" height="20" style={{ color: '#0E7490' }}><rect x="4" y="3" width="16" height="18" rx="3" stroke="currentColor" strokeWidth="1.8"/><line x1="8" y1="9" x2="16" y2="9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><line x1="8" y1="13" x2="16" y2="13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><line x1="8" y1="17" x2="12" y2="17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
            </span>
            <div className="nav-row-body">
              <span className="nav-row-label">Care Journal</span>
              <span className="nav-row-sub">Observations & notes</span>
            </div>
            <svg viewBox="0 0 24 24" fill="none" width="16" height="16" style={{ color: 'rgba(60,60,67,0.28)' }}><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </div>
        </div>
      </section>

      {/* Score snapshot */}
      <section className="app-section">
        <div className="sup-section-header">
          <div className="sup-section-dot" style={{ background: scoreColor }}/>
          <h2 className="app-section-title" style={{ margin: 0 }}>Score Snapshot</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { label: 'Current', value: acseScore, color: scoreColor, bg: `${scoreColor}14` },
            { label: 'Status', value: acseScore >= 80 ? 'Stable' : acseScore >= 60 ? 'Mod.' : 'Critical', color: scoreColor, bg: `${scoreColor}14` },
            { label: 'Trend', value: '+2', color: '#34C759', bg: 'rgba(52,199,89,0.10)' },
          ].map(m => (
            <div key={m.label} style={{ background: m.bg, borderRadius: 14, padding: '12px 10px', textAlign: 'center', border: `1px solid ${m.color}22` }}>
              <p style={{ fontSize: 22, fontWeight: 700, color: m.color, margin: 0 }}>{m.value}</p>
              <p style={{ fontSize: 11, color: 'rgba(60,60,67,0.55)', margin: '2px 0 0', fontWeight: 500 }}>{m.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Medication adherence */}
      <section className="app-section">
        <div className="sup-section-header">
          <div className="sup-section-dot" style={{ background: '#EA6C00' }}/>
          <h2 className="app-section-title" style={{ margin: 0 }}>Medication Adherence</h2>
        </div>
        <div className="app-card" style={{ padding: '4px', borderLeft: '3px solid rgba(234,108,0,0.4)' }}>
          <MedicationAdherence />
        </div>
      </section>

      {/* Weekly insights inline */}
      <section className="app-section">
        <div className="sup-section-header">
          <div className="sup-section-dot" style={{ background: '#0891B2' }}/>
          <h2 className="app-section-title" style={{ margin: 0 }}>Weekly Summary</h2>
        </div>
        <div className="app-card" style={{ padding: '4px', borderLeft: '3px solid rgba(8,145,178,0.4)' }}>
          <WeeklyInsights />
        </div>
      </section>

      {/* Vitals dashboard inline */}
      <section className="app-section">
        <div className="sup-section-header">
          <div className="sup-section-dot" style={{ background: '#FF375F' }}/>
          <h2 className="app-section-title" style={{ margin: 0 }}>Vitals</h2>
        </div>
        <div className="app-card" style={{ padding: 4, borderLeft: '3px solid rgba(255,55,95,0.4)' }}>
          <VitalsDashboard patientName={user?.name} />
        </div>
      </section>

      <div style={{ height: 24 }} />
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function SupervisorView() {
  const [tab, setTab] = useState<SupTab>('overview');
  const [panel, setPanel] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { user, acseScore, supervisorAlerts, clearSupervisorAlert, activateComfortMode, comfortModeActive } = useAppStore();
  const setScreen = useAppStore(s => s.setScreen);
  const panelRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  const firstName = user?.name?.split(' ')[0] ?? 'Patient';

  useEffect(() => {
    if (!panelRef.current || !panel) return;
    gsap.fromTo(panelRef.current,
      { x: '100%', opacity: 0.7 },
      { x: '0%', opacity: 1, duration: 0.34, ease: 'power3.out' }
    );
  }, [panel]);

  const handleTabChange = (t: SupTab) => {
    if (t === tab) return;
    if (mainRef.current) {
      gsap.fromTo(mainRef.current, { opacity: 0.5, y: 8 }, { opacity: 1, y: 0, duration: 0.28, ease: 'power2.out' });
    }
    setTab(t);
  };

  const openPanel = (id: string) => setPanel(id);
  const closePanel = () => {
    if (panelRef.current) {
      gsap.to(panelRef.current, { x: '100%', opacity: 0.7, duration: 0.26, ease: 'power2.in', onComplete: () => setPanel(null) });
    } else setPanel(null);
  };

  if (panel) {
    return (
      <>
        <div ref={panelRef} className="app-panel">
          <div className="app-panel-header">
            <button className="app-back-btn" onClick={closePanel}>
              <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Back
            </button>
            <span className="app-panel-title">{SUP_PANEL_TITLES[panel] ?? panel}</span>
            <div style={{ width: 60 }} />
          </div>
          <div className="app-panel-content">
            {panel === 'events'      && <EventsTab user={user} />}
            {panel === 'medications' && <MedicationsTab user={user} />}
            {panel === 'routine'     && <RoutineManager />}
            {panel === 'stats'       && <StatsTab user={user} />}
            {panel === 'journal'     && <div className="panel-scroll-inner"><CareJournal /></div>}
          </div>
        </div>
        <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </>
    );
  }

  return (
    <div className="app-shell">
      <SupHeader
        patientName={firstName}
        supervisorName={user?.caregiverName ?? ''}
        acseScore={acseScore}
        onSettings={() => setSettingsOpen(true)}
        onSwitch={() => setScreen('login')}
      />

      {supervisorAlerts.length > 0 && (
        <div className="alert-banner">
          <StudioIcon name="alert" size={18} />
          <span style={{ flex: 1, fontSize: 14 }}>{supervisorAlerts[0].message}</span>
          <button onClick={() => clearSupervisorAlert(supervisorAlerts[0].id)}
            className="studio-icon-btn" aria-label="Dismiss">
            <StudioIcon name="close" size={14} />
          </button>
        </div>
      )}

      <main ref={mainRef} className="app-main">
        {tab === 'overview'  && <OverviewTab user={user} acseScore={acseScore} onOpen={openPanel} onComfortMode={activateComfortMode} comfortActive={comfortModeActive} />}
        {tab === 'schedule'  && <ScheduleTab user={user} onOpen={openPanel} />}
        {tab === 'acse'      && <ACSETab user={user} />}
        {tab === 'insights'  && <InsightsTab user={user} onOpen={openPanel} />}
      </main>

      <SupTabBar active={tab} onChange={handleTabChange} />
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

// ── Events Tab ────────────────────────────────────────────────────────────────
function EventsTab({ user }: { user: User | null }) {
  const [filter, setFilter] = useState<'all' | 'completed' | 'upcoming' | 'alerts'>('all');
  const [showForm, setShowForm] = useState(false);
  const [caregiverMsg, setCaregiverMsg] = useState('');
  const [newEvent, setNewEvent] = useState({
    title: '', description: '', datetime: '', type: 'planned' as Event['type'],
  });

  const events = useLiveQuery<Event[]>(
    () => user?.id ? db.events.where('userId').equals(user.id).sortBy('timestamp') : Promise.resolve([]),
    [user?.id]
  ) ?? [];

  const filtered = events.filter((e) => {
    if (filter === 'completed') return e.completed;
    if (filter === 'upcoming')  return !e.completed && new Date(e.timestamp) > new Date();
    if (filter === 'alerts')    return e.type === 'system_alert';
    return true;
  }).reverse();

  const handleAddEvent = async () => {
    if (!user?.id || !newEvent.title || !newEvent.datetime) return;
    await db.events.add({
      userId: user.id,
      timestamp: new Date(newEvent.datetime).toISOString(),
      type: newEvent.type,
      title: newEvent.title,
      description: newEvent.description || newEvent.title,
      completed: false,
      source: 'caregiver',
    });
    setNewEvent({ title: '', description: '', datetime: '', type: 'planned' });
    setShowForm(false);
  };

  const handleCaregiverMsg = async () => {
    if (!user?.id || !caregiverMsg.trim()) return;
    const msg = caregiverMsg.trim();

    // Try to parse a time from the message
    const timeMatch = msg.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    let timestamp = new Date().toISOString();
    if (timeMatch) {
      try {
        const d = new Date();
        const parts = timeMatch[1].replace(/\s/g, '').match(/(\d{1,2})(?::(\d{2}))?([ap]m)?/i);
        if (parts) {
          let h = parseInt(parts[1]);
          const m = parseInt(parts[2] ?? '0');
          if (parts[3]?.toLowerCase() === 'pm' && h < 12) h += 12;
          if (parts[3]?.toLowerCase() === 'am' && h === 12) h = 0;
          d.setHours(h, m, 0, 0);
          timestamp = d.toISOString();
        }
      } catch { /* ignore parse errors */ }
    }

    await db.events.add({
      userId: user.id,
      timestamp,
      type: 'caregiver_input',
      title: `Caregiver note`,
      description: msg,
      completed: false,
      source: 'caregiver',
    });
    setCaregiverMsg('');
  };

  const handleToggleComplete = async (event: Event) => {
    if (event.id) await db.events.update(event.id, { completed: !event.completed });
  };

  const handleDelete = async (id: number) => {
    await db.events.delete(id);
  };

  return (
    <div className="events-tab">
      {/* Caregiver quick message */}
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <p className="studio-section-title">Quick Caregiver Note</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={caregiverMsg}
            onChange={(e) => setCaregiverMsg(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCaregiverMsg()}
            placeholder="e.g. I'll visit at 6 PM"
            className="studio-input"
            style={{ flex: 1 }}
          />
          <button onClick={handleCaregiverMsg} className="studio-btn studio-btn--primary tap-feedback" style={{ padding: '10px 16px' }}>
            Add
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto' }}>
        {(['all', 'completed', 'upcoming', 'alerts'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`studio-chip tap-feedback ${filter === f ? 'studio-chip--active' : ''}`}
            style={{ fontWeight: filter === f ? 600 : 400 }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Add event button */}
      <button
        onClick={() => setShowForm(!showForm)}
        className={`studio-btn tap-feedback ${showForm ? '' : 'studio-btn--primary'}`}
        style={{ marginBottom: 12, width: '100%', alignItems: 'center' }}
      >
        {showForm ? 'Cancel' : 'Add Event'}
      </button>

      {/* Add event form */}
      {showForm && (
        <div className="card animate-fadeIn" style={{ padding: 16, marginBottom: 16 }}>
          <input
            value={newEvent.title}
            onChange={(e) => setNewEvent((p) => ({ ...p, title: e.target.value }))}
            placeholder="Event title"
            className="studio-input"
            style={{ marginBottom: 8 }}
          />
          <textarea
            value={newEvent.description}
            onChange={(e) => setNewEvent((p) => ({ ...p, description: e.target.value }))}
            placeholder="Description (optional)"
            rows={2}
            className="studio-textarea"
            style={{ marginBottom: 8 }}
          />
          <input
            type="datetime-local"
            value={newEvent.datetime}
            onChange={(e) => setNewEvent((p) => ({ ...p, datetime: e.target.value }))}
            className="studio-input"
            style={{ marginBottom: 8 }}
          />
          <select
            value={newEvent.type}
            onChange={(e) => setNewEvent((p) => ({ ...p, type: e.target.value as Event['type'] }))}
            className="studio-select"
            style={{ marginBottom: 12 }}
          >
            <option value="planned">Planned</option>
            <option value="caregiver_input">Caregiver Input</option>
            <option value="system_alert">System Alert</option>
          </select>
          <button className="btn-electric tap-feedback" style={{ width: '100%' }} onClick={handleAddEvent}>
            Save Event
          </button>
        </div>
      )}

      {/* Event list */}
      {filtered.map((e) => (
        <div
          key={e.id}
          className="card"
          style={{
            padding: '14px 16px',
            marginBottom: 10,
            opacity: e.completed ? 0.6 : 1,
            borderLeft: e.type === 'system_alert' ? '3px solid #FF3B30' : e.completed ? '3px solid #34C759' : '3px solid rgba(0,0,0,0.10)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <p className="studio-text-bright" style={{ fontSize: 17, fontWeight: 600, margin: '0 0 2px' }}>{e.title}</p>
              <p className="studio-text-muted" style={{ fontSize: 14, margin: '0 0 4px' }}>
                {new Date(e.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
              <p className="studio-text-muted" style={{ fontSize: 15, margin: 0 }}>{e.description}</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginLeft: 8 }}>
              <button
                onClick={() => handleToggleComplete(e)}
                className="studio-icon-btn tap-feedback"
                style={{ background: e.completed ? 'var(--studio-surface-soft)' : 'var(--studio-card-bg)' }}
                aria-label={e.completed ? 'Mark incomplete' : 'Mark complete'}
              >
                <StudioIcon name={e.completed ? 'check' : 'circle'} size={16} />
              </button>
              <button
                onClick={() => e.id && handleDelete(e.id)}
                className="studio-icon-btn tap-feedback"
                style={{ color: 'rgba(0,0,0,0.38)' }}
                aria-label="Delete event"
              >
                <StudioIcon name="close" size={16} />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Medications Tab (supervisor CRUD) ─────────────────────────────────────────
function MedicationsTab({ user }: { user: User | null }) {
  const { setUser } = useAppStore();
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [form, setForm] = useState<Medication>({ name: '', dosage: '', schedule: ['8:00 AM'] });
  const [showAdd, setShowAdd] = useState(false);

  const logs = useLiveQuery<import('../db/db').MedicationLog[]>(
    () => user?.id ? db.medicationLogs.where('userId').equals(user.id).sortBy('timestamp') : Promise.resolve([]),
    [user?.id]
  ) ?? [];

  const sortedLogs = [...logs].reverse().slice(0, 8);

  const initials = user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2) ?? '?';

  const resetForm = () => {
    setForm({ name: '', dosage: '', schedule: ['8:00 AM'] });
    setEditingIdx(null);
    setShowAdd(false);
  };

  const handleSaveNew = async () => {
    if (!user?.id || !form.name.trim()) return;
    const updated = await addMedication(user.id, { ...form, name: form.name.trim() });
    if (updated) setUser(updated);
    resetForm();
  };

  const handleSaveEdit = async () => {
    if (!user?.id || editingIdx === null || !form.name.trim()) return;
    const updated = await replaceMedication(user.id, editingIdx, { ...form, name: form.name.trim() });
    if (updated) setUser(updated);
    resetForm();
  };

  const handleDelete = async (idx: number) => {
    if (!user?.id) return;
    const updated = await removeMedication(user.id, idx);
    if (updated) setUser(updated);
    if (editingIdx === idx) resetForm();
  };

  const startEdit = (idx: number) => {
    if (!user) return;
    setEditingIdx(idx);
    setShowAdd(false);
    setForm({ ...user.medications[idx] });
  };

  if (!user) return null;

  return (
    <div className="supervisor-meds">
      <div className="card supervisor-meds__patient">
        {user.familyPhotoUrl ? (
          <img src={user.familyPhotoUrl} alt={user.name} className="supervisor-meds__photo" />
        ) : (
          <div className="supervisor-meds__photo supervisor-meds__photo--placeholder">{initials}</div>
        )}
        <div>
          <p className="supervisor-meds__name">{user.name}</p>
          <p className="studio-text-muted">Age {user.age} · {user.city}</p>
          <p className="studio-text-muted">{user.medications.length} active medications</p>
        </div>
      </div>

      <div className="supervisor-meds__toolbar">
        <h2 className="studio-page-title" style={{ margin: 0 }}>Medication plan</h2>
        <button className="studio-btn studio-btn--primary tap-feedback" onClick={() => { setShowAdd(true); setEditingIdx(null); setForm({ name: '', dosage: '', schedule: ['8:00 AM'] }); }}>
          + Add med
        </button>
      </div>

      {(showAdd || editingIdx !== null) && (
        <div className="card supervisor-meds__form animate-fadeIn">
          <p className="studio-section-title">{editingIdx !== null ? 'Edit medication' : 'New medication'}</p>
          <input className="studio-input" placeholder="Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} style={{ marginBottom: 8 }} />
          <input className="studio-input" placeholder="Dosage, e.g. 10mg" value={form.dosage} onChange={(e) => setForm((p) => ({ ...p, dosage: e.target.value }))} style={{ marginBottom: 8 }} />
          <input className="studio-input" placeholder="Schedule, e.g. 8:00 AM, 8:00 PM" value={form.schedule.join(', ')} onChange={(e) => setForm((p) => ({ ...p, schedule: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))} style={{ marginBottom: 10 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="studio-btn studio-btn--primary tap-feedback" style={{ flex: 1 }} onClick={editingIdx !== null ? handleSaveEdit : handleSaveNew}>
              Save
            </button>
            <button className="studio-btn tap-feedback" onClick={resetForm}>Cancel</button>
          </div>
        </div>
      )}

      {user.medications.map((m, i) => (
        <div key={`${m.name}-${i}`} className="card supervisor-meds__item">
          <div className="supervisor-meds__item-main">
            <p className="supervisor-meds__item-name"><StudioIcon name="meds" size={18} /> {m.name}</p>
            <p className="studio-text-muted">{m.dosage}</p>
            <p className="studio-text-muted">{m.schedule.join(' · ')}</p>
          </div>
          <div className="supervisor-meds__item-actions">
            <button className="studio-icon-btn tap-feedback" aria-label="Edit" onClick={() => startEdit(i)}><StudioIcon name="refresh" size={16} /></button>
            <button className="studio-icon-btn tap-feedback" aria-label="Delete" style={{ color: 'rgba(0,0,0,0.38)' }} onClick={() => handleDelete(i)}><StudioIcon name="close" size={16} /></button>
          </div>
        </div>
      ))}

      <MedicationAdherence />

      <h3 className="studio-section-title" style={{ marginTop: 20 }}>Recent intake logs</h3>
      {sortedLogs.length === 0 && <p className="studio-text-muted">No logs yet.</p>}
      {sortedLogs.map((log) => (
        <div key={log.id} className="card" style={{ padding: '12px 14px', marginBottom: 8 }}>
          <p className="studio-text-bright" style={{ margin: 0, fontWeight: 600 }}>{log.medicationName}</p>
          <p className="studio-text-muted" style={{ margin: '4px 0 0', fontSize: 14 }}>
            {new Date(log.timestamp).toLocaleString()} · {log.visionConfidence}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── ACSE Tab (dedicated tab) + Stats panel ────────────────────────────────────
function ACSETab({ user }: { user: User | null }) {
  return (
    <div className="tab-scroll">
      <section className="app-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#7C3AED' }}/>
          <h2 className="app-section-title" style={{ margin: 0 }}>ACSE Score Analysis</h2>
        </div>
      </section>
      <div style={{ padding: '0 16px' }}>
        <StatsTab user={user} />
      </div>
    </div>
  );
}

function StatsTab({ user }: { user: User | null }) {
  const { acseScore } = useAppStore();

  const scoreHistory = useLiveQuery<import('../db/db').AcseScore[]>(
    () =>
      user?.id
        ? db.acseScores
            .where('userId')
            .equals(user.id)
            .and((s) => new Date(s.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000))
            .sortBy('timestamp')
        : Promise.resolve([]),
    [user?.id]
  ) ?? [];

  const weekHistory = useLiveQuery<import('../db/db').AcseScore[]>(
    () =>
      user?.id
        ? db.acseScores
            .where('userId')
            .equals(user.id)
            .and((s) => new Date(s.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
            .sortBy('timestamp')
        : Promise.resolve([]),
    [user?.id]
  ) ?? [];

  const color = acseScore >= 75 ? '#10B981' : acseScore >= 50 ? '#F59E0B' : '#EF4444';

  // 24h chart data with rolling 5-point average
  const chartData = scoreHistory.map((s, i, arr) => {
    const window = arr.slice(Math.max(0, i - 4), i + 1);
    const avg = Math.round(window.reduce((a, b) => a + b.score, 0) / window.length);
    return {
      time: new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      score: s.score,
      avg,
      reason: s.reason,
    };
  });

  // Score zone distribution
  const stable = scoreHistory.filter((s) => s.score >= 75).length;
  const moderate = scoreHistory.filter((s) => s.score >= 50 && s.score < 75).length;
  const critical = scoreHistory.filter((s) => s.score < 50).length;
  const total = scoreHistory.length || 1;
  const distData = [
    { zone: 'Stable (75–100)', pct: Math.round((stable / total) * 100), fill: '#10B981' },
    { zone: 'Moderate (50–74)', pct: Math.round((moderate / total) * 100), fill: '#F59E0B' },
    { zone: 'Critical (<50)', pct: Math.round((critical / total) * 100), fill: '#EF4444' },
  ];

  // Hourly pattern from week data
  const hourBuckets: Record<number, number[]> = {};
  weekHistory.forEach((s) => {
    const h = new Date(s.timestamp).getHours();
    if (!hourBuckets[h]) hourBuckets[h] = [];
    hourBuckets[h].push(s.score);
  });
  const hourlyData = Array.from({ length: 24 }, (_, h) => ({
    hour: h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`,
    avg: hourBuckets[h]
      ? Math.round(hourBuckets[h].reduce((a, b) => a + b, 0) / hourBuckets[h].length)
      : null,
  })).filter((d) => d.avg !== null);

  // Min/max/delta
  const minScore = scoreHistory.length ? Math.min(...scoreHistory.map((s) => s.score)) : acseScore;
  const maxScore = scoreHistory.length ? Math.max(...scoreHistory.map((s) => s.score)) : acseScore;
  const delta = scoreHistory.length >= 2
    ? scoreHistory[scoreHistory.length - 1].score - scoreHistory[0].score
    : 0;

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) => {
    if (!active || !payload?.length) return null;
    const score = payload.find((p) => p.name === 'score')?.value;
    const avg = payload.find((p) => p.name === 'avg')?.value;
    const zone = score !== undefined ? (score >= 75 ? 'Stable' : score >= 50 ? 'Moderate' : 'Critical') : '';
    const zoneColor = score !== undefined ? (score >= 75 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444') : '#999';
    return (
      <div style={{ background: 'var(--studio-card-bg)', border: '1px solid var(--studio-border)', borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>
        <p style={{ margin: '0 0 4px', fontWeight: 600 }}>{label}</p>
        {score !== undefined && <p style={{ margin: '0 0 2px', color: zoneColor }}>Score: <strong>{score}</strong> · {zone}</p>}
        {avg !== undefined && <p style={{ margin: 0, color: 'var(--studio-text-muted)' }}>5-pt avg: {avg}</p>}
      </div>
    );
  };

  return (
    <div className="stats-tab">
      <VitalsDashboard patientName={user?.name} />
      <ACSESignalAudit />
      <WeeklyInsights />

      <h2 className="studio-page-title" style={{ marginTop: 8 }}>ACSE — Cognitive Score</h2>

      {/* Score summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Now', value: acseScore, color },
          { label: 'High today', value: maxScore, color: '#10B981' },
          { label: 'Low today', value: minScore, color: '#EF4444' },
          { label: '24h delta', value: `${delta >= 0 ? '+' : ''}${delta}`, color: delta >= 0 ? '#10B981' : '#EF4444' },
        ].map((m) => (
          <div key={m.label} className="card" style={{ padding: '12px 10px', textAlign: 'center' }}>
            <p style={{ fontSize: 26, fontWeight: 700, color: m.color, margin: 0 }}>{m.value}</p>
            <p className="studio-text-muted" style={{ fontSize: 11, margin: 0 }}>{m.label}</p>
          </div>
        ))}
      </div>

      {/* Rich 24h ACSE chart */}
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <p className="studio-section-title" style={{ marginBottom: 12 }}>24h Score Timeline</p>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="scoreAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <ReferenceArea y1={75} y2={100} fill="#10B981" fillOpacity={0.06} />
              <ReferenceArea y1={50} y2={75}  fill="#F59E0B" fillOpacity={0.06} />
              <ReferenceArea y1={0}  y2={50}  fill="#EF4444" fillOpacity={0.06} />
              <CartesianGrid strokeDasharray="3 3" stroke="var(--studio-border)" />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} ticks={[0, 25, 50, 75, 100]} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={75} stroke="#10B981" strokeDasharray="4 4" />
              <ReferenceLine y={50} stroke="#EF4444" strokeDasharray="4 4" />
              <Area type="monotone" dataKey="score" name="score" stroke={color} strokeWidth={2.5}
                fill="url(#scoreAreaGrad)" dot={{ fill: color, r: 3, strokeWidth: 0 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="avg" name="avg" stroke="var(--studio-text-muted)"
                strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
              {chartData.length > 10 && (
                <Brush dataKey="time" height={20} stroke="var(--studio-border)" travellerWidth={6} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <p className="studio-text-muted" style={{ textAlign: 'center', padding: '32px 0' }}>No score history yet today.</p>
        )}
        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: 'var(--studio-text-muted)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 16, height: 2, background: color, display: 'inline-block', borderRadius: 1 }} /> Score
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 16, height: 2, background: 'var(--studio-text-muted)', display: 'inline-block', borderRadius: 1, borderTop: '2px dashed var(--studio-text-muted)' }} /> 5-pt avg
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, background: '#10B981', opacity: 0.18, display: 'inline-block', borderRadius: 2 }} /> Stable
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, background: '#F59E0B', opacity: 0.18, display: 'inline-block', borderRadius: 2 }} /> Moderate
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, background: '#EF4444', opacity: 0.18, display: 'inline-block', borderRadius: 2 }} /> Critical
          </span>
        </div>
      </div>

      {/* Score zone distribution */}
      {scoreHistory.length > 0 && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <p className="studio-section-title" style={{ marginBottom: 12 }}>Time in Each Zone (today)</p>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={distData} layout="vertical" margin={{ left: 90, right: 40, top: 0, bottom: 0 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
              <YAxis type="category" dataKey="zone" tick={{ fontSize: 11 }} width={88} />
              <Tooltip formatter={(v: number) => [`${v}%`, 'Time']} contentStyle={{ fontSize: 13, borderRadius: 8 }} />
              <Bar dataKey="pct" radius={[0, 6, 6, 0]} label={{ position: 'right', fontSize: 11, formatter: (v: number) => `${v}%` }}>
                {distData.map((d) => <Cell key={d.zone} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Hourly pattern (7-day) */}
      {hourlyData.length > 0 && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <p className="studio-section-title" style={{ marginBottom: 4 }}>Hourly Score Pattern (7-day avg)</p>
          <p className="studio-text-muted" style={{ fontSize: 12, marginBottom: 10 }}>Average ACSE by hour of day — helps identify sundowning or low-energy windows.</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={hourlyData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--studio-border)" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} ticks={[0, 50, 75, 100]} />
              <Tooltip formatter={(v: number) => [`${v}`, 'Avg ACSE']} contentStyle={{ fontSize: 13, borderRadius: 8 }} />
              <ReferenceLine y={50} stroke="#EF4444" strokeDasharray="3 3" />
              <ReferenceLine y={75} stroke="#10B981" strokeDasharray="3 3" />
              <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                {hourlyData.map((d) => (
                  <Cell
                    key={d.hour}
                    fill={d.avg !== null && d.avg >= 75 ? '#10B981' : d.avg !== null && d.avg >= 50 ? '#F59E0B' : '#EF4444'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Score event log */}
      {scoreHistory.length > 0 && (
        <div>
          <h3 className="studio-section-title">Score Events</h3>
          {[...scoreHistory].reverse().slice(0, 10).map((s, i) => {
            const prev = [...scoreHistory].reverse()[i + 1];
            const diff = prev ? s.score - prev.score : 0;
            return (
              <div key={i} className="card" style={{ padding: '10px 14px', marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: s.score < 50 ? '#EF4444' : s.score < 75 ? '#F59E0B' : '#10B981' }}>
                      {s.score}
                    </span>
                    {prev && (
                      <span style={{ fontSize: 12, color: diff >= 0 ? '#10B981' : '#EF4444', fontWeight: 600 }}>
                        {diff >= 0 ? `+${diff}` : diff}
                      </span>
                    )}
                  </div>
                  <span className="studio-text-muted" style={{ fontSize: 12 }}>
                    {new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {s.reason && <p className="studio-text-muted" style={{ fontSize: 13, margin: '4px 0 0' }}>{s.reason}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

