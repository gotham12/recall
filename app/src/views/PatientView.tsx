import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAppStore } from '../store/appStore';
import { useACSE } from '../hooks/useACSE';
import { db } from '../db/db';
import StateReconCard from '../components/StateReconCard';
import { LeafLogo } from '../components/LoadingScreen';
import VoiceAgent from '../components/VoiceAgent';
import MedTracker from '../components/MedTracker';
import ACSEDashboard from '../components/ACSEDashboard';

type Tab = 'home' | 'voice' | 'meds' | 'events' | 'stability';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'home', label: 'Home', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/>
    </svg>
  )},
  { id: 'voice', label: 'Clara', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0014 0M12 19v3M8 22h8"/>
    </svg>
  )},
  { id: 'meds', label: 'Meds', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0016.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 002 8.5c0 2.3 1.5 4.05 3 5.5l7 7z"/>
    </svg>
  )},
  { id: 'events', label: 'Today', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )},
  { id: 'stability', label: 'Score', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="22 12 18 12 15 20 9 4 6 12 2 12"/>
    </svg>
  )},
];

export default function PatientView() {
  const [tab, setTab] = useState<Tab>('home');
  const { user, setScreen } = useAppStore();
  const { recordNavigation } = useACSE();

  const changeTab = (t: Tab) => { if (t !== tab) { recordNavigation(); setTab(t); } };

  return (
    <div className="app-shell">
      {/* Header */}
      <div className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LeafLogo size={28} color="#16A34A" />
          <span className="logo-text" style={{ fontSize: 18, color: 'var(--text)' }}>Recall</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="t-caption">Hi, {user?.name?.split(' ')[0]}</span>
          <button onClick={() => setScreen('login')} style={{ background: 'var(--green-dim)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', padding: '6px 8px', color: 'var(--muted)', display: 'flex' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'home'      && <HomeTab onVoice={() => changeTab('voice')} />}
        {tab === 'voice'     && <VoiceAgent />}
        {tab === 'meds'      && <MedTracker />}
        {tab === 'events'    && <EventsTab />}
        {tab === 'stability' && <ACSEDashboard />}
      </div>

      {/* Tab bar */}
      <div className="tab-bar">
        {TABS.map(t => (
          <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => changeTab(t.id)}>
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function HomeTab({ onVoice }: { onVoice: () => void }) {
  const user = useAppStore((s) => s.user);
  const events = useLiveQuery(() => user?.id ? db.events.where('userId').equals(user.id).sortBy('timestamp') : [], [user?.id]) ?? [];
  const now = new Date();
  const upcoming  = events.filter(e => !e.completed && new Date(e.timestamp) > now).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const completed = events.filter(e => e.completed).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="scroll-area">
      {/* Hero greeting */}
      <div style={{ padding: '28px 20px 20px', position: 'relative' }}>
        {/* Decorative dew dots */}
        <div className="dew-dot" style={{ width: 10, height: 10, top: 22, right: 40, animation: 'dewPulse 4s ease-in-out infinite' }} />
        <div className="dew-dot" style={{ width: 6,  height: 6,  top: 38, right: 70, animation: 'dewPulse 5s ease-in-out infinite 1s' }} />
        <div className="dew-dot" style={{ width: 14, height: 14, top: 16, right: 24, animation: 'dewPulse 3.5s ease-in-out infinite 0.5s' }} />
        <div className="t-overline" style={{ marginBottom: 10 }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
        <div className="t-headline" style={{ fontSize: 36 }}>{greeting},<br />{user?.name?.split(' ')[0]}.</div>
        <div className="t-body" style={{ marginTop: 8, fontSize: 14 }}>How are you feeling today?</div>
      </div>

      {/* State Reconstruction */}
      <div style={{ padding: '0 16px 16px' }}>
        <StateReconCard />
      </div>

      {/* Talk to Clara CTA */}
      <div style={{ padding: '0 16px 16px' }}>
        <button onClick={onVoice} style={{
          width: '100%', padding: '18px 20px', background: 'var(--surface)',
          border: '1px solid var(--border)', borderRadius: 16,
          display: 'flex', alignItems: 'center', gap: 14,
          cursor: 'pointer', textAlign: 'left',
        }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--green-dim)', border: '1px solid rgba(34,197,94,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round"><rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0014 0M12 19v3M8 22h8"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 15, color: 'var(--navy)' }}>Talk to Clara</div>
            <div className="t-caption" style={{ marginTop: 2 }}>Your AI companion is ready</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </button>
      </div>

      {/* Medications */}
      {(user?.medications ?? []).length > 0 && (
        <div style={{ padding: '0 16px 16px' }}>
          <div className="t-label" style={{ marginBottom: 10 }}>Medications</div>
          <div className="card" style={{ overflow: 'hidden' }}>
            {(user?.medications ?? []).map((m, i) => {
              const taken = events.some(e => e.title.toLowerCase().includes(m.name.toLowerCase()) && e.completed);
              return (
                <div key={i} className="list-row">
                  <div className={`icon-box${taken ? '' : '-blue'}`} style={taken ? { background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' } : {}}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={taken ? 'var(--success)' : 'var(--blue)'} strokeWidth="2" strokeLinecap="round">
                      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0016.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 002 8.5c0 2.3 1.5 4.05 3 5.5l7 7z"/>
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 15, color: 'var(--navy)' }}>{m.name}</div>
                    <div className="t-caption">{m.dosage} · {m.schedule[0]}</div>
                  </div>
                  <div className={`chip ${taken ? 'chip-success' : 'chip-blue'}`}>
                    <span className="chip-dot" />{taken ? 'Taken' : 'Due'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div style={{ padding: '0 16px 16px' }}>
          <div className="t-label" style={{ marginBottom: 10 }}>Coming Up</div>
          <div className="card" style={{ overflow: 'hidden' }}>
            {upcoming.slice(0, 3).map(e => (
              <div key={e.id} className="list-row">
                <div className="icon-box-blue">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 15, color: 'var(--navy)' }}>{e.title}</div>
                  <div className="t-caption">{new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent */}
      {completed.length > 0 && (
        <div style={{ padding: '0 16px 16px' }}>
          <div className="t-label" style={{ marginBottom: 10 }}>Completed</div>
          <div className="card" style={{ overflow: 'hidden' }}>
            {completed.slice(0, 4).map(e => (
              <div key={e.id} className="list-row">
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div style={{ flex: 1, fontFamily: 'Inter', fontWeight: 500, fontSize: 14, color: 'var(--navy)' }}>{e.title}</div>
                <div className="t-caption">{new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ height: 16 }} />
    </div>
  );
}

function EventsTab() {
  const user = useAppStore((s) => s.user);
  const events = useLiveQuery(() => user?.id ? db.events.where('userId').equals(user.id).sortBy('timestamp') : [], [user?.id]) ?? [];

  return (
    <div className="scroll-area">
      <div style={{ padding: '20px 20px 12px' }}>
        <div className="t-overline" style={{ marginBottom: 6 }}>Patient view</div>
        <div className="t-headline" style={{ fontSize: 22 }}>Today's Timeline</div>
      </div>

      <div style={{ padding: '0 16px 16px' }}>
        <div className="card" style={{ overflow: 'hidden' }}>
          {[...events].reverse().map((e, i) => {
            const color = e.completed ? 'var(--success)' : e.type === 'system_alert' ? 'var(--danger)' : 'var(--blue)';
            return (
              <div key={e.id} style={{ padding: '14px 16px', borderBottom: i < events.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 3, alignSelf: 'stretch', background: color, borderRadius: 4, flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 14, color: 'var(--navy)' }}>{e.title}</span>
                    <div className={`chip ${e.completed ? 'chip-success' : e.type === 'system_alert' ? 'chip-danger' : 'chip-blue'}`} style={{ fontSize: 10 }}>
                      {e.completed ? 'Done' : e.type === 'system_alert' ? 'Alert' : 'Planned'}
                    </div>
                  </div>
                  <div className="t-caption">{e.description}</div>
                  <div className="t-caption" style={{ marginTop: 4, color: 'var(--muted)' }}>
                    {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {e.source}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
