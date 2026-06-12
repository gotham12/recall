import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import StateReconCard from '../components/StateReconCard';
import VoiceAgent from '../components/VoiceAgent';
import MedTracker from '../components/MedTracker';
import ACSEDashboard from '../components/ACSEDashboard';
import StudioShell from '../components/StudioShell';
import RecallLogo from '../components/RecallLogo';
import StudioIcon, { type IconName } from '../components/StudioIcon';
import { useACSE } from '../hooks/useACSE';
import { useAppStore } from '../store/appStore';
import { db, type Event, type Medication } from '../db/db';
import ThemeToggle from '../components/ThemeToggle';
import { isMedicationDueSoon } from '../lib/schedule';
import { logout } from '../lib/session';
import MemoryThreads from '../components/MemoryThreads';
import WhereAmICard from '../components/WhereAmICard';
import RoutineChecklist from '../components/RoutineChecklist';
import FamiliarFaces from '../components/FamiliarFaces';
import SafetyCircle from '../components/SafetyCircle';
import EmergencySOS from '../components/EmergencySOS';
import SettingsSheet from '../components/SettingsSheet';
import CaregiverMirror from '../components/CaregiverMirror';
import GoldenPathDemo from '../components/GoldenPathDemo';
import MemoryPhotoRecap from '../components/MemoryPhotoRecap';
import SleepTracker from '../components/SleepTracker';
import GameHub from '../components/games/GameHub';
import DashHero from '../components/DashHero';
import SoundSanctuary from '../components/SoundSanctuary';

type Tab = 'home' | 'mind' | 'sleep' | 'voice' | 'meds' | 'events' | 'sanctuary';

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'home',      label: 'Home',     icon: 'home' },
  { id: 'mind',      label: 'Mind',     icon: 'brain' },
  { id: 'sleep',     label: 'Sleep',    icon: 'moon' },
  { id: 'voice',     label: 'Clara',    icon: 'clara' },
  { id: 'meds',      label: 'Meds',     icon: 'meds' },
  { id: 'events',    label: 'Today',    icon: 'events' },
  { id: 'sanctuary', label: 'Calm',     icon: 'music' },
];

function eventIcon(type: Event['type']): IconName {
  if (type === 'user_action') return 'success';
  if (type === 'planned') return 'calendar';
  if (type === 'caregiver_input') return 'user';
  return 'warning';
}

function timeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function PatientView() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const logoTaps = useRef(0);
  const logoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { user, acseScore, demoMode, setDemoMode, comfortModeActive, triggerMemoryRecap } = useAppStore();
  const { recordNavigation } = useACSE();

  // Activity is recorded on tab navigation only — not on every tap.

  const handleTabChange = (tab: Tab) => {
    recordNavigation();
    setMoreOpen(false);
    setActiveTab(tab);
  };

  const handleLogoTap = () => {
    logoTaps.current += 1;
    if (logoTimer.current) clearTimeout(logoTimer.current);
    logoTimer.current = setTimeout(() => { logoTaps.current = 0; }, 800);
    if (logoTaps.current >= 3) {
      logoTaps.current = 0;
      setDemoMode(true);
    }
  };

  const events = useLiveQuery<Event[]>(
    () => user?.id ? db.events.where('userId').equals(user.id).sortBy('timestamp') : Promise.resolve([]),
    [user?.id]
  );

  const firstName = user?.name?.split(' ')[0] ?? 'there';

  return (
    <StudioShell
      contentKey={activeTab}
      header={
        <div className="studio-header">
          <button type="button" className="recall-logo-tap tap-feedback" onClick={handleLogoTap} aria-label="Recall">
            <RecallLogo size="sm" />
          </button>
          <div className="studio-header__actions">
            <EmergencySOS inline />
            <ThemeToggle />
            <button
              onClick={() => setSettingsOpen(true)}
              className="studio-icon-btn tap-feedback"
              aria-label="Settings"
            >
              <StudioIcon name="settings" size={18} />
            </button>
            <button
              onClick={logout}
              className="studio-icon-btn tap-feedback"
              aria-label="Log out"
            >
              <StudioIcon name="logout" size={18} />
            </button>
          </div>
        </div>
      }
      footer={
        <nav className="studio-tab-bar studio-tab-bar--dense tab-bar" aria-label="Main navigation">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`studio-tab tap-feedback ${activeTab === tab.id ? 'studio-tab--active' : ''}`}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              <span className="studio-tab__icon">
                <StudioIcon name={tab.icon} size={22} />
              </span>
              <span className="studio-tab__label">{tab.label}</span>
            </button>
          ))}
        </nav>
      }
    >
      {activeTab === 'home' && (
        <HomeTab
          events={events ?? []}
          onNavigate={handleTabChange}
          firstName={firstName}
          acseScore={acseScore}
          caregiverName={user?.caregiverName}
          caregiverPhone={user?.caregiverPhone}
          medications={user?.medications ?? []}
          moreOpen={moreOpen}
          onToggleMore={() => setMoreOpen((v) => !v)}
          onMemoryRecap={() => triggerMemoryRecap('manual')}
        />
      )}
      {activeTab === 'mind' && (
        <div className="mind-tab studio-scroll">
          <GameHub />
        </div>
      )}
      {activeTab === 'sleep' && (
        <div className="sleep-tab studio-scroll">
          <SleepTracker dashboard />
        </div>
      )}
      {activeTab === 'voice' && <VoiceAgent />}
      {activeTab === 'meds' && <MedTracker />}
      {activeTab === 'events' && <EventsTab events={events ?? []} />}
      {activeTab === 'sanctuary' && <SoundSanctuary />}
      {!comfortModeActive && <CaregiverMirror />}
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {demoMode && (
        <GoldenPathDemo
          onNavigate={(tab) => setActiveTab(tab)}
          onClose={() => setDemoMode(false)}
        />
      )}
      <MemoryPhotoRecap />
    </StudioShell>
  );
}

const QUICK_ACTIONS: { icon: IconName; label: string; color: string; tab?: Tab; action?: string }[] = [
  { icon: 'clara',  label: 'Clara',      color: '#AF52DE', tab: 'voice' },
  { icon: 'brain',  label: 'Mind',       color: '#007AFF', tab: 'mind' },
  { icon: 'moon',   label: 'Sleep',      color: '#5856D6', tab: 'sleep' },
  { icon: 'meds',   label: 'Meds',       color: '#FF9500', tab: 'meds' },
  { icon: 'events', label: 'Today',      color: '#34C759', tab: 'events' },
  { icon: 'music',  label: 'Calm',       color: '#5AC8FA', tab: 'sanctuary' },
];

function QuickTile({ icon, label, color, onClick }: { icon: IconName; label: string; color: string; onClick: () => void }) {
  return (
    <button type="button" className="quick-tile tap-feedback" onClick={onClick} aria-label={label}>
      <span className="quick-tile__icon" style={{ background: color }}>
        <StudioIcon name={icon} size={22} />
      </span>
      <span className="quick-tile__label">{label}</span>
    </button>
  );
}

function HomeTab({
  events,
  onNavigate,
  firstName,
  acseScore,
  caregiverName,
  caregiverPhone,
  medications,
  moreOpen,
  onToggleMore,
  onMemoryRecap,
}: {
  events: Event[];
  onNavigate: (tab: Tab) => void;
  firstName: string;
  acseScore: number;
  caregiverName?: string;
  caregiverPhone?: string;
  medications: Medication[];
  moreOpen: boolean;
  onToggleMore: () => void;
  onMemoryRecap: () => void;
}) {
  const now = new Date();
  const dueMeds = medications.filter((m) => isMedicationDueSoon(m.schedule));
  const medsTotal = medications.length;
  const medsDone = medications.filter((m) => !isMedicationDueSoon(m.schedule)).length;
  const upcoming = events
    .filter((e) => !e.completed && new Date(e.timestamp) > now)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(0, 3);

  const dateLabel = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  const scoreColor = acseScore >= 80 ? '#34C759' : acseScore >= 60 ? '#FF9500' : '#FF3B30';

  return (
    <div className="home-tab studio-scroll">
      <DashHero greeting={timeGreeting()} firstName={firstName} dateLabel={dateLabel} />

      {dueMeds.length > 0 && (
        <button type="button" className="home-alert-strip home-alert-strip--meds tap-feedback" onClick={() => onNavigate('meds')}>
          <StudioIcon name="meds" size={18} />
          <span>{dueMeds.length === 1 ? `${dueMeds[0].name} is due` : `${dueMeds.length} medications due now`}</span>
        </button>
      )}

      <p className="ios-section-label">Quick access</p>
      <div className="quick-grid">
        {QUICK_ACTIONS.map((a) => (
          <QuickTile
            key={a.label}
            icon={a.icon}
            label={a.label}
            color={a.color}
            onClick={() => a.tab ? onNavigate(a.tab) : onMemoryRecap()}
          />
        ))}
      </div>

      <p className="ios-section-label">Your health</p>
      <div className="metric-row">
        <button type="button" className="metric-card tap-feedback" onClick={() => onNavigate('home')}>
          <span className="metric-card__label">Wellness</span>
          <span className="metric-card__value" style={{ color: scoreColor }}>{acseScore}</span>
          <span className="metric-card__sub">score</span>
          <div className="metric-card__bar">
            <div className="metric-card__fill" style={{ width: `${acseScore}%`, background: scoreColor }} />
          </div>
        </button>
        <button type="button" className="metric-card tap-feedback" onClick={() => onNavigate('meds')}>
          <span className="metric-card__label">Meds</span>
          <span className="metric-card__value" style={{ color: '#FF9500' }}>{medsDone}<span className="metric-card__denom">/{medsTotal}</span></span>
          <span className="metric-card__sub">taken today</span>
          <div className="metric-card__bar">
            <div className="metric-card__fill" style={{ width: medsTotal ? `${(medsDone / medsTotal) * 100}%` : '0%', background: '#FF9500' }} />
          </div>
        </button>
        <button type="button" className="metric-card tap-feedback" onClick={() => onNavigate('events')}>
          <span className="metric-card__label">Events</span>
          <span className="metric-card__value" style={{ color: '#34C759' }}>{upcoming.length}</span>
          <span className="metric-card__sub">coming up</span>
          <div className="metric-card__bar">
            <div className="metric-card__fill" style={{ width: upcoming.length > 0 ? '60%' : '0%', background: '#34C759' }} />
          </div>
        </button>
      </div>

      <div className="ios-list-section">
        <WhereAmICard />
        <StateReconCard />
      </div>

      {upcoming.length > 0 && (
        <>
          <p className="ios-section-label">Coming up</p>
          <div className="ios-list-cards">
            {upcoming.map((e) => (
              <div key={e.id} className="ios-event-row">
                <span className="ios-event-dot" style={{ background: e.type === 'planned' ? '#007AFF' : e.completed ? '#34C759' : '#FF9500' }} />
                <div className="ios-event-body">
                  <p className="ios-event-title">{e.title}</p>
                  <p className="ios-event-time">{formatTime(e.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {caregiverName && caregiverPhone && (
        <a href={`tel:${caregiverPhone}`} className="caregiver-call-strip tap-feedback">
          <span className="caregiver-call-strip__avatar">{caregiverName.split(' ').map(n => n[0]).join('').slice(0,2)}</span>
          <div>
            <p className="caregiver-call-strip__name">{caregiverName}</p>
            <p className="caregiver-call-strip__hint">Your caregiver · Tap to call</p>
          </div>
          <StudioIcon name="send" size={18} />
        </a>
      )}

      <button type="button" className="home-more-toggle tap-feedback" onClick={onToggleMore} aria-expanded={moreOpen}>
        <StudioIcon name={moreOpen ? 'close' : 'add'} size={16} />
        <span>{moreOpen ? 'Hide more' : 'Routines & support'}</span>
      </button>

      {moreOpen && (
        <div className="home-more-panel animate-fadeIn">
          <RoutineChecklist />
          <MemoryThreads />
          <FamiliarFaces />
          <SafetyCircle />
        </div>
      )}

      <div style={{ height: 20 }} />
    </div>
  );
}

function EventsTab({ events }: { events: Event[] }) {
  const now = new Date();
  const sorted = [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="events-tab studio-scroll">
      <h2 className="studio-page-title">Today's story</h2>
      {sorted.length === 0 && (
        <p className="studio-empty-note">No events yet today.</p>
      )}
      <div className="timeline">
        {sorted.map((e, i) => {
          const isFuture = !e.completed && new Date(e.timestamp) > now;
          const isLast = i === sorted.length - 1;

          return (
            <div
              key={e.id}
              className={`timeline__item ${isFuture ? 'timeline__item--future' : ''} ${e.completed ? 'timeline__item--done' : ''}`}
            >
              <div className="timeline__rail">
                <div className="event-icon-badge">
                  <StudioIcon name={eventIcon(e.type)} size={20} />
                </div>
                {!isLast && <div className="timeline__line" />}
              </div>
              <div className="timeline__content">
                <div className="timeline__header">
                  <p className="event-card__title">{e.title}</p>
                  {e.completed && <span className="timeline__badge">Done</span>}
                  {isFuture && <span className="timeline__badge timeline__badge--future">Upcoming</span>}
                </div>
                <p className="event-card__meta">{formatTime(e.timestamp)}</p>
                <p className="timeline__desc">{e.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
