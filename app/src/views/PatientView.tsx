import { useState } from 'react';
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

type Tab = 'home' | 'voice' | 'meds' | 'events' | 'stability';

const TAB_FLOWER_KEYS: Record<Tab, FlowerKey> = {
  home: 'home',
  voice: 'patient',
  meds: 'patientEnter',
  events: 'landing',
  stability: 'supervisor',
};

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'home',      label: 'Home',    icon: 'home' },
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
  const { user, setScreen, acseScore, theme } = useAppStore();
  const flowers = getFlowers(theme);
  const { recordNavigation } = useACSE();

  const handleTabChange = (tab: Tab) => {
    recordNavigation();
    setActiveTab(tab);
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
          <RecallLogo size="sm" />
          <div className="studio-header__actions">
            <div className="studio-header__greeting">
              <span className="studio-header__greeting-label">{timeGreeting()}</span>
              <span className="studio-header__meta">{firstName}</span>
            </div>
            <ThemeToggle />
            <button
              onClick={() => setScreen('login')}
              className="studio-icon-btn tap-feedback"
              aria-label="Log out"
            >
              <StudioIcon name="logout" size={18} />
            </button>
          </div>
        </div>
      }
      footer={
        <nav className="studio-tab-bar tab-bar" aria-label="Main navigation">
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
          medications={user?.medications ?? []}
        />
      )}
      {activeTab === 'voice' && <VoiceAgent />}
      {activeTab === 'meds' && <MedTracker />}
      {activeTab === 'events' && <EventsTab events={events ?? []} />}
      {activeTab === 'stability' && <ACSEDashboard />}
    </StudioShell>
  );
}

function HomeTab({
  events,
  onNavigate,
  firstName,
  acseScore,
  caregiverName,
  medications,
}: {
  events: Event[];
  onNavigate: (tab: Tab) => void;
  firstName: string;
  acseScore: number;
  caregiverName?: string;
  medications: Medication[];
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
      <div className="home-tab__hero">
        <p className="home-tab__date">{dateLabel}</p>
        <h1 className="home-tab__title">{timeGreeting()}, {firstName}</h1>
      </div>

      <StateReconCard />

      {dueMeds.length > 0 && (
        <button
          type="button"
          className="med-due-banner tap-feedback"
          onClick={() => onNavigate('meds')}
        >
          <StudioIcon name="meds" size={22} />
          <div className="med-due-banner__body">
            <p className="med-due-banner__title">
              {dueMeds.length === 1
                ? `Time for ${dueMeds[0].name}`
                : `${dueMeds.length} medications due now`}
            </p>
            <p className="med-due-banner__text">
              {dueMeds.map((m) => `${m.name} (${m.dosage})`).join(' · ')}
            </p>
          </div>
          <span className="med-due-banner__action">Take</span>
        </button>
      )}

      {acseScore < 75 && (
        <div className={`wellness-banner ${acseScore < 50 ? 'wellness-banner--low' : ''}`}>
          <StudioIcon name={acseScore < 50 ? 'alert' : 'moderate'} size={20} />
          <div>
            <p className="wellness-banner__title">
              {acseScore < 50 ? 'Take a moment to rest' : 'Go at your own pace'}
            </p>
            <p className="wellness-banner__text">
              {acseScore < 50
                ? 'Comfort mode can help you feel grounded.'
                : 'Tap Score to see how you are doing today.'}
            </p>
          </div>
          <button
            type="button"
            className="wellness-banner__action tap-feedback"
            onClick={() => onNavigate('stability')}
          >
            View
          </button>
        </div>
      )}

      {caregiverName && (
        <a href="tel:+15555550100" className="caregiver-chip tap-feedback">
          <StudioIcon name="user" size={18} />
          <span>Call {caregiverName}</span>
        </a>
      )}

      <section className="home-tab__section">
        <h3 className="studio-section-title">Quick actions</h3>
        <div className="quick-actions">
          <button type="button" className="quick-action tap-feedback" onClick={() => onNavigate('voice')}>
            <span className="quick-action__icon"><StudioIcon name="clara" size={22} /></span>
            <span className="quick-action__label">Talk to Clara</span>
          </button>
          <button type="button" className="quick-action tap-feedback" onClick={() => onNavigate('meds')}>
            <span className="quick-action__icon"><StudioIcon name="meds" size={22} /></span>
            <span className="quick-action__label">Take medication</span>
          </button>
          <button type="button" className="quick-action tap-feedback" onClick={() => onNavigate('events')}>
            <span className="quick-action__icon"><StudioIcon name="events" size={22} /></span>
            <span className="quick-action__label">Today's story</span>
          </button>
        </div>
      </section>

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
