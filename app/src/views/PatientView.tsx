import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import StateReconCard from '../components/StateReconCard';
import VoiceAgent from '../components/VoiceAgent';
import MedTracker from '../components/MedTracker';
import ACSEDashboard from '../components/ACSEDashboard';
import StudioShell from '../components/StudioShell';
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

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home',      label: 'Home',    icon: '🏠' },
  { id: 'voice',     label: 'Clara',   icon: '🎙️' },
  { id: 'meds',      label: 'Meds',    icon: '💊' },
  { id: 'events',    label: 'Today',   icon: '📋' },
  { id: 'stability', label: 'Score',   icon: '📊' },
];

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
      header={
        <div className="studio-header">
          <span className="studio-header__title">Recall</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="studio-header__meta">Hi, {user?.name?.split(' ')[0]}</span>
            <button
              onClick={() => setScreen('login')}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', fontSize: 14, cursor: 'pointer', padding: 4 }}
            >
              ⎋
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
              <span className="studio-tab__icon">{tab.icon}</span>
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

// ── Home Tab ──────────────────────────────────────────────────────────────────
function HomeTab({ events }: { events: Event[] }) {
  const now = new Date();
  const upcoming = events
    .filter((e) => !e.completed && new Date(e.timestamp) > now)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(0, 3);

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {/* State Reconstruction Card */}
      <div style={{ paddingTop: 16 }}>
        <StateReconCard />
      </div>

      <div style={{ padding: '16px 16px 32px' }}>
        <h3 className="studio-section-title">Coming Up</h3>
        {upcoming.length === 0 ? (
          <p className="studio-text-muted" style={{ fontSize: 18 }}>Nothing scheduled — enjoy your day.</p>
        ) : (
          upcoming.map((e) => (
            <div key={e.id} className="card" style={{ padding: '14px 16px', marginBottom: 10, display: 'flex', gap: 12 }}>
              <span style={{ fontSize: 22 }}>
                {e.type === 'planned' ? '📅' : e.type === 'system_alert' ? '⚠️' : '✅'}
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

// ── Events Tab ────────────────────────────────────────────────────────────────
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
        const icon =
          e.type === 'user_action' ? '✅' :
          e.type === 'planned'     ? '📅' :
          e.type === 'caregiver_input' ? '👤' :
          '⚠️';
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
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: e.completed ? '#EEF6FF' : '#F0E8DC',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  flexShrink: 0,
                }}
              >
                {icon}
              </div>
              <div style={{ width: 2, flex: 1, background: '#E5D5C0', minHeight: 16 }} />
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
