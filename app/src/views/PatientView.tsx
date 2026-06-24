import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import StateReconCard from '../components/StateReconCard';
import VoiceAgent from '../components/VoiceAgent';
import MedTracker from '../components/MedTracker';
import ACSEDashboard from '../components/ACSEDashboard';
import StudioIcon, { type IconName } from '../components/StudioIcon';
import { useACSE } from '../hooks/useACSE';
import { useAppStore } from '../store/appStore';
import { db, type Event, type Medication } from '../db/db';
import { isMedicationDueSoon } from '../lib/schedule';
import WhereAmICard from '../components/WhereAmICard';
import FamiliarFaces from '../components/FamiliarFaces';
import SafetyCircle from '../components/SafetyCircle';
import SettingsSheet from '../components/SettingsSheet';
import GoldenPathDemo from '../components/GoldenPathDemo';
import MemoryPhotoRecap from '../components/MemoryPhotoRecap';
import DashHero from '../components/DashHero';
import RoutineChecklist from '../components/RoutineChecklist';
import GameHub from '../components/games/GameHub';
import { markGameRoutineComplete } from '../components/RoutineChecklist';
import HomeIconGrid from '../components/HomeIconGrid';
import FlowerGarden from '../components/FlowerGarden';

type Tab = 'home' | 'voice' | 'meds' | 'events' | 'routine' | 'games';

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'home',    label: 'Home',    icon: 'home' },
  { id: 'voice',   label: 'Clara',   icon: 'clara' },
  { id: 'meds',    label: 'Meds',    icon: 'meds' },
  { id: 'games',   label: 'Games',   icon: 'puzzle' },
  { id: 'routine', label: 'Routine', icon: 'routine' },
  { id: 'events',  label: 'Today',   icon: 'events' },
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

const FEATURE_LABELS: Record<string, string> = {
  voice: 'Clara',
  meds: 'Medications',
  games: 'Mind Games',
  routine: 'Routine',
  events: 'Today',
  memory: 'Memory',
  safety: 'Safety',
  faces: 'Familiar Faces',
};

export default function PatientView() {
  const [activeFeature, setActiveFeature] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { user, acseScore, demoMode, setDemoMode, triggerMemoryRecap } = useAppStore();
  const { recordNavigation } = useACSE();
  const setScreen = useAppStore((s) => s.setScreen);

  const events = useLiveQuery<Event[]>(
    () => user?.id ? db.events.where('userId').equals(user.id).sortBy('timestamp') : Promise.resolve([]),
    [user?.id]
  );

  const firstName = user?.name?.split(' ')[0] ?? 'there';

  const openFeature = (id: string) => { recordNavigation(); setActiveFeature(id); };
  const goHome = () => setActiveFeature(null);

  // ── visionOS home grid ──────────────────────────────────────────────────────
  if (!activeFeature) {
    return (
      <>
        <HomeIconGrid
          role="patient"
          userName={`Hi, ${firstName}`}
          onSelect={openFeature}
          onSwitchRole={() => setScreen('login')}
        />
        <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        <MemoryPhotoRecap />
        {demoMode && (
          <GoldenPathDemo
            onNavigate={(tab) => openFeature(tab)}
            onClose={() => setDemoMode(false)}
          />
        )}
      </>
    );
  }

  // ── Feature panel ────────────────────────────────────────────────────────────
  return (
    <div className="vis-feature-wrap">
      <div className="vis-feature-header">
        <button className="vis-back-btn" onClick={goHome} aria-label="Back to home">
          <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
        <span className="vis-feature-title">{FEATURE_LABELS[activeFeature] ?? activeFeature}</span>
        <button className="studio-icon-btn tap-feedback" onClick={() => setSettingsOpen(true)} aria-label="Settings"
          style={{ marginLeft: 'auto' }}>
          <StudioIcon name="settings" size={18} />
        </button>
      </div>

      <div className="vis-feature-content studio-scroll">
        {activeFeature === 'voice'   && <VoiceAgent />}
        {activeFeature === 'meds'    && <MedTracker />}
        {activeFeature === 'events'  && <EventsTab events={events ?? []} />}
        {activeFeature === 'games'   && user?.id && <GamesTab userId={user.id} />}
        {activeFeature === 'routine' && <RoutineChecklist />}
        {activeFeature === 'memory'  && (
          <div className="vis-feature-scroll-inner">
            <DashHero greeting="Memory" firstName={firstName} dateLabel={new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })} />
            <StateReconCard />
            <WhereAmICard />
            <ACSEDashboard />
            <div style={{ padding: '0 16px' }}>
              <button
                type="button"
                className="vis-memory-recap-btn tap-feedback"
                onClick={() => triggerMemoryRecap('manual')}
              >
                Start memory recap
              </button>
            </div>
          </div>
        )}
        {activeFeature === 'safety' && (
          <div className="vis-feature-scroll-inner">
            <SafetyCircle />
          </div>
        )}
        {activeFeature === 'faces' && (
          <div className="vis-feature-scroll-inner">
            <FamiliarFaces />
          </div>
        )}
      </div>

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <MemoryPhotoRecap />
    </div>
  );
}

const QUICK_ACTIONS: { icon: IconName; label: string; color: string; tab?: Tab; action?: string }[] = [
  { icon: 'clara',   label: 'Clara',   color: 'transparent', tab: 'voice' },
  { icon: 'meds',    label: 'Meds',    color: 'transparent', tab: 'meds' },
  { icon: 'puzzle',  label: 'Games',   color: 'transparent', tab: 'games' },
  { icon: 'routine', label: 'Routine', color: 'transparent', tab: 'routine' },
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
  medications,
  onMemoryRecap,
}: {
  events: Event[];
  onNavigate: (tab: Tab) => void;
  firstName: string;
  acseScore: number;
  medications: Medication[];
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
      <FlowerGarden />
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

      <p className="ios-section-label">People & support</p>
      <div className="home-support-section">
        <FamiliarFaces />
        <SafetyCircle />
      </div>

      <div style={{ height: 20 }} />
    </div>
  );
}

function GamesTab({ userId }: { userId: number }) {
  return (
    <div className="studio-scroll" style={{ padding: '16px 16px 40px' }}>
      <GameHub
        onGameComplete={(gameId) => void markGameRoutineComplete(userId, gameId)}
      />
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
