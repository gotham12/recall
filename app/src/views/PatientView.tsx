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
import { db, type Event } from '../db/db';
import { FLOWERS } from '../flowers';

type Tab = 'home' | 'voice' | 'meds' | 'events' | 'stability';

const TAB_FLOWERS: Record<Tab, string> = {
  home: FLOWERS.home,
  voice: FLOWERS.patient,
  meds: FLOWERS.patientEnter,
  events: FLOWERS.landing,
  stability: FLOWERS.supervisor,
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

export default function PatientView() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const { user, setScreen } = useAppStore();
  const { recordNavigation } = useACSE();

  const handleTabChange = (tab: Tab) => {
    recordNavigation();
    setActiveTab(tab);
  };

  const events = useLiveQuery<Event[]>(
    () => user?.id ? db.events.where('userId').equals(user.id).sortBy('timestamp') : Promise.resolve([]),
    [user?.id]
  );

  return (
    <StudioShell
      flowerSrc={TAB_FLOWERS[activeTab]}
      contentKey={activeTab}
      header={
        <div className="studio-header">
          <RecallLogo size="sm" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="studio-header__meta">Hi, {user?.name?.split(' ')[0]}</span>
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
        <div className="studio-tab-bar tab-bar">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`studio-tab ${activeTab === tab.id ? 'studio-tab--active' : ''}`}
            >
              <span className="studio-tab__icon">
                <StudioIcon name={tab.icon} size={20} />
              </span>
              <span className="studio-tab__label">{tab.label}</span>
            </button>
          ))}
        </div>
      }
    >
      {activeTab === 'home' && <HomeTab events={events ?? []} />}
      {activeTab === 'voice' && <VoiceAgent />}
      {activeTab === 'meds' && <MedTracker />}
      {activeTab === 'events' && <EventsTab events={events ?? []} />}
      {activeTab === 'stability' && <ACSEDashboard />}
    </StudioShell>
  );
}

function HomeTab({ events }: { events: Event[] }) {
  const now = new Date();
  const upcoming = events
    .filter((e) => !e.completed && new Date(e.timestamp) > now)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(0, 3);

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ paddingTop: 16 }}>
        <StateReconCard />
      </div>

      <div style={{ padding: '16px 16px 32px' }}>
        <h3 className="studio-section-title">Coming Up</h3>
        {upcoming.length === 0 ? (
          <p className="studio-text-muted" style={{ fontSize: 18 }}>Nothing scheduled — enjoy your day.</p>
        ) : (
          upcoming.map((e) => (
            <div key={e.id} className="card" style={{ padding: '14px 16px', marginBottom: 10, display: 'flex', gap: 12, alignItems: 'center' }}>
              <span className="event-icon-badge">
                <StudioIcon name={eventIcon(e.type)} size={20} />
              </span>
              <div>
                <p className="studio-text-bright" style={{ fontSize: 18, fontWeight: 600, margin: '0 0 2px' }}>
                  {e.title}
                </p>
                <p className="studio-text-muted" style={{ fontSize: 15, margin: 0 }}>
                  {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function EventsTab({ events }: { events: Event[] }) {
  const sorted = [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
      <h2 className="studio-text-bright" style={{ fontSize: 24, margin: '0 0 20px', letterSpacing: '0.06em' }}>Today's Story</h2>
      {sorted.length === 0 && (
        <p className="studio-text-muted" style={{ fontSize: 18 }}>No events yet today.</p>
      )}
      {sorted.map((e) => {
        const timeStr = new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return (
          <div
            key={e.id}
            style={{
              display: 'flex',
              gap: 14,
              marginBottom: 20,
              opacity: !e.completed && new Date(e.timestamp) > new Date() ? 0.5 : 1,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
              <div className="event-icon-badge">
                <StudioIcon name={eventIcon(e.type)} size={20} />
              </div>
              <div style={{ width: 2, flex: 1, background: 'rgba(62,48,38,0.15)', minHeight: 16 }} />
            </div>
            <div style={{ paddingTop: 6, flex: 1 }}>
              <p className="studio-text-bright" style={{ fontSize: 18, fontWeight: 600, margin: '0 0 2px' }}>
                {e.title}
              </p>
              <p className="studio-text-muted" style={{ fontSize: 15, margin: '0 0 4px' }}>{timeStr}</p>
              <p className="studio-text-muted" style={{ fontSize: 16, margin: 0, lineHeight: 1.5 }}>
                {e.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
