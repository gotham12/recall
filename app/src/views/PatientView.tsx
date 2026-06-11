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
import { getFlowers, type FlowerKey } from '../flowers';
import ThemeToggle from '../components/ThemeToggle';
import { isMedicationDueSoon } from '../lib/schedule';
import { logout } from '../lib/session';
import MemoryThreads from '../components/MemoryThreads';
import PresencePulseBanner from '../components/PresencePulse';
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
import { CLARA_BACKGROUND, CLARA_PORTRAIT } from '../lib/clara';
import { memoryPhotoUrl } from '../lib/memoryPhotos';

type Tab = 'home' | 'mind' | 'sleep' | 'voice' | 'meds' | 'events' | 'stability';

const TAB_FLOWER_KEYS: Record<Tab, FlowerKey> = {
  home: 'home',
  mind: 'patient',
  sleep: 'landing',
  voice: 'patient',
  meds: 'patientEnter',
  events: 'landing',
  stability: 'supervisor',
};

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'home',      label: 'Home',    icon: 'home' },
  { id: 'mind',      label: 'Mind',    icon: 'brain' },
  { id: 'sleep',     label: 'Sleep',   icon: 'moon' },
  { id: 'voice',     label: 'Clara',   icon: 'clara' },
  { id: 'meds',      label: 'Meds',    icon: 'meds' },
  { id: 'events',    label: 'Today',   icon: 'events' },
  { id: 'stability', label: 'Score',   icon: 'score' },
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
  const { user, acseScore, theme, demoMode, setDemoMode, comfortModeActive, triggerMemoryRecap } = useAppStore();
  const flowers = getFlowers(theme);
  const { recordNavigation, recordActivity } = useACSE();

  useEffect(() => {
    const onInteract = () => recordActivity();
    window.addEventListener('pointerdown', onInteract);
    return () => window.removeEventListener('pointerdown', onInteract);
  }, [recordActivity]);

  const handleTabChange = (tab: Tab) => {
    recordNavigation();
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
      flowerSrc={flowers[TAB_FLOWER_KEYS[activeTab]]}
      contentKey={activeTab}
      dimOverlay={0.76}
      header={
        <div className="studio-header">
          <button type="button" className="recall-logo-tap tap-feedback" onClick={handleLogoTap} aria-label="Recall">
            <RecallLogo size="sm" />
          </button>
          <div className="studio-header__actions">
            <div className="studio-header__greeting">
              <span className="studio-header__greeting-label">{timeGreeting()}</span>
              <span className="studio-header__meta">{firstName}</span>
            </div>
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
      {activeTab === 'stability' && <ACSEDashboard />}
      {!comfortModeActive && <CaregiverMirror />}
      <EmergencySOS />
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

function HomePhotoWidget({
  photo,
  avatar,
  icon,
  label,
  sub,
  onClick,
}: {
  photo: string;
  avatar?: string;
  icon: IconName;
  label: string;
  sub?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="home-widget tap-feedback" onClick={onClick} aria-label={label}>
      <img src={photo} alt="" className="home-widget__photo" />
      {avatar && <img src={avatar} alt="" className="home-widget__avatar" />}
      <div className="home-widget__caption">
        <StudioIcon name={icon} size={18} />
        <div className="home-widget__caption-text">
          <span className="home-widget__label">{label}</span>
          {sub && <span className="home-widget__sub">{sub}</span>}
        </div>
      </div>
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
  const upcoming = events
    .filter((e) => !e.completed && new Date(e.timestamp) > now)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(0, 3);

  const dateLabel = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="home-tab studio-scroll">
      <PresencePulseBanner />

      <header className="home-hero-slim">
        <div className="home-hero-slim__text">
          <p className="home-tab__date">{dateLabel}</p>
          <h1 className="home-tab__title">{timeGreeting()}, {firstName}</h1>
        </div>
        {caregiverName && (
          <a href={`tel:${caregiverPhone ?? '+15555550100'}`} className="home-hero-slim__call tap-feedback" aria-label={`Call ${caregiverName}`}>
            <StudioIcon name="user" size={18} />
          </a>
        )}
      </header>

      {dueMeds.length > 0 && (
        <button type="button" className="home-alert-strip home-alert-strip--meds tap-feedback" onClick={() => onNavigate('meds')}>
          <StudioIcon name="meds" size={18} />
          <span>{dueMeds.length === 1 ? `${dueMeds[0].name} due now` : `${dueMeds.length} meds due`}</span>
        </button>
      )}

      {acseScore < 75 && (
        <button type="button" className={`home-alert-strip home-alert-strip--wellness tap-feedback ${acseScore < 50 ? 'home-alert-strip--low' : ''}`} onClick={() => onNavigate('stability')}>
          <StudioIcon name={acseScore < 50 ? 'alert' : 'moderate'} size={18} />
          <span>{acseScore < 50 ? 'Take a moment to rest' : 'Go at your own pace'}</span>
        </button>
      )}

      <div className="home-widgets">
        <HomePhotoWidget photo={memoryPhotoUrl('garden')} icon="heart" label="Memories" onClick={onMemoryRecap} />
        <HomePhotoWidget photo={CLARA_BACKGROUND} avatar={CLARA_PORTRAIT} icon="clara" label="Clara" sub="Tap to talk" onClick={() => onNavigate('voice')} />
        <HomePhotoWidget photo={memoryPhotoUrl('birthday')} icon="brain" label="Mind games" onClick={() => onNavigate('mind')} />
        <HomePhotoWidget photo={memoryPhotoUrl('porch')} icon="moon" label="Sleep" onClick={() => onNavigate('sleep')} />
        <HomePhotoWidget photo={memoryPhotoUrl('dinner')} icon="meds" label="Meds" onClick={() => onNavigate('meds')} />
        <HomePhotoWidget photo={memoryPhotoUrl('picnic')} icon="events" label="Today" onClick={() => onNavigate('events')} />
      </div>

      <div className="home-status-cards">
        <WhereAmICard />
        <StateReconCard />
      </div>

      <button type="button" className="home-more-toggle home-more-toggle--slim tap-feedback" onClick={onToggleMore} aria-expanded={moreOpen}>
        <StudioIcon name={moreOpen ? 'close' : 'add'} size={16} />
        <span>{moreOpen ? 'Hide extras' : 'Routines & support'}</span>
      </button>

      {moreOpen && (
        <div className="home-more-panel animate-fadeIn">
          <RoutineChecklist />
          <MemoryThreads />
          <FamiliarFaces />
          <SafetyCircle />
        </div>
      )}

      <section className="home-tab__section">
        <h3 className="studio-section-title">Coming up</h3>
        {upcoming.length === 0 ? (
          <p className="studio-empty-note">Nothing scheduled — enjoy your day.</p>
        ) : (
          <div className="event-list">
            {upcoming.map((e) => (
              <div key={e.id} className="event-card event-card--upcoming">
                <span className="event-icon-badge">
                  <StudioIcon name={eventIcon(e.type)} size={20} />
                </span>
                <div className="event-card__body">
                  <p className="event-card__title">{e.title}</p>
                  <p className="event-card__meta">{formatTime(e.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
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
