import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useAppStore } from '../store/appStore';
import { db, type RecallEvent, type User, type Medication } from '../db/db';
import { parseCaregiverMessage } from '../services/groq';
import { LeafLogo } from '../components/LeafLogo';

type Tab = 'home' | 'events' | 'medications' | 'acse' | 'profile';
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'home', label: 'Home', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg> },
  { id: 'events', label: 'Events', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
  { id: 'medications', label: 'Meds', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0016.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 002 8.5c0 2.3 1.5 4.05 3 5.5l7 7z"/></svg> },
  { id: 'acse', label: 'ACSE', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 20 9 4 6 12 2 12"/></svg> },
  { id: 'profile', label: 'Profile', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
];

export default function SupervisorView() {
  const [tab, setTab] = useState<Tab>('home');
  const { user, supervisorAlerts, clearSupervisorAlert, setScreen } = useAppStore();

  return (
    <div className="app-shell view-enter">
      <div className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LeafLogo size={28} color="#16A34A" />
          <span className="logo-text" style={{ fontSize: 18, color: 'var(--text)' }}>Supervisor</span>
        </div>
        <button onClick={() => setScreen('opening')} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', padding: '6px 12px', color: 'var(--muted-2)', fontFamily: 'Inter', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Logout
        </button>
      </div>

      {supervisorAlerts.map(a => (
        <div key={a.id} className="alert-banner">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span style={{ flex: 1, color: 'var(--danger)', fontSize: 13, fontFamily: 'Inter', fontWeight: 600 }}>{a.message}</span>
          <button onClick={() => clearSupervisorAlert(a.id)} style={{ background: 'none', border: 'none', color: 'var(--muted-2)', cursor: 'pointer', display: 'flex' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      ))}

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'home'        && <HomeTab user={user} />}
        {tab === 'events'      && <EventsTab user={user} />}
        {tab === 'medications' && <MedicationsTab user={user} />}
        {tab === 'acse'        && <AcseTab user={user} />}
        {tab === 'profile'     && <ProfileTab />}
      </div>

      <div className="tab-bar">
        {TABS.map(t => (
          <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Home ──────────────────────────────────────────────────────────────────────
function HomeTab({ user }: { user: User | null }) {
  const { acseScore, setScreen } = useAppStore();
  const eventCount = useLiveQuery(() => user?.id ? db.events.where('userId').equals(user.id).count() : Promise.resolve(0), [user?.id]) ?? 0;
  const medsTaken  = useLiveQuery(() => user?.id ? db.medicationLogs.where('userId').equals(user.id).and(l => l.confirmed && new Date(l.timestamp).toDateString() === new Date().toDateString()).count() : Promise.resolve(0), [user?.id]) ?? 0;
  const totalMeds  = user?.medications?.length ?? 0;
  const scoreColor = acseScore >= 75 ? 'var(--success)' : acseScore >= 50 ? 'var(--warning)' : 'var(--danger)';

  return (
    <div className="scroll-area">
      <div style={{ padding: '20px 20px 12px' }}>
        <div className="t-overline" style={{ marginBottom: 6, color: 'var(--warning)' }}>Supervisor dashboard</div>
        <div className="t-headline" style={{ fontSize: 22 }}>{user?.name ?? 'Patient'}</div>
        <div className="t-caption">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
      </div>

      {/* Stats grid */}
      <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div className="card" style={{ padding: '18px 16px' }}>
          <div className="t-label" style={{ marginBottom: 8 }}>ACSE Score</div>
          <div style={{ fontFamily: 'Inter', fontSize: 38, fontWeight: 800, color: scoreColor, lineHeight: 1 }}>{acseScore}</div>
          <div style={{ marginTop: 8 }}>
            <div className={`chip ${acseScore >= 75 ? 'chip-success' : acseScore >= 50 ? 'chip-warning' : 'chip-danger'}`}>
              <span className="chip-dot"/>{acseScore >= 75 ? 'Stable' : acseScore >= 50 ? 'Moderate' : 'Critical'}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '18px 16px' }}>
          <div className="t-label" style={{ marginBottom: 8 }}>Events Today</div>
          <div style={{ fontFamily: 'Inter', fontSize: 38, fontWeight: 800, color: 'var(--blue)', lineHeight: 1 }}>{eventCount}</div>
          <div style={{ marginTop: 8 }}><div className="chip chip-blue"><span className="chip-dot"/>Recorded</div></div>
        </div>

        <div className="card" style={{ padding: '18px 16px' }}>
          <div className="t-label" style={{ marginBottom: 8 }}>Meds Today</div>
          <div style={{ fontFamily: 'Inter', fontSize: 38, fontWeight: 800, color: 'var(--success)', lineHeight: 1 }}>
            {medsTaken}<span style={{ fontSize: 18, fontWeight: 500, color: 'var(--muted-2)' }}>/{totalMeds}</span>
          </div>
          <div style={{ marginTop: 8 }}><div className="chip chip-success"><span className="chip-dot"/>On track</div></div>
        </div>

        <div className="card" style={{ padding: '18px 16px', cursor: 'pointer' }} onClick={() => setScreen('patient')}>
          <div className="t-label" style={{ marginBottom: 8 }}>Patient View</div>
          <div style={{ marginTop: 6 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="1.6" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <div style={{ marginTop: 8 }}><div className="chip chip-blue"><span className="chip-dot"/>Switch</div></div>
        </div>
      </div>

      <div style={{ padding: '0 16px 16px' }}>
        <button className="btn btn-primary" style={{ width: '100%', padding: 16 }} onClick={() => setScreen('patient')}>
          Switch to Patient View
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </button>
      </div>
    </div>
  );
}

// ── Events ────────────────────────────────────────────────────────────────────
function EventsTab({ user }: { user: User | null }) {
  const [filter, setFilter]       = useState<'all'|'completed'|'upcoming'|'alerts'>('all');
  const [showForm, setShowForm]   = useState(false);
  const [caregiverMsg, setCaregiverMsg] = useState('');
  const [parsing, setParsing]     = useState(false);
  const [newEvent, setNewEvent]   = useState({ datetime: '', title: '', description: '', type: 'planned' });

  const events = useLiveQuery(() =>
    user?.id ? db.events.where('userId').equals(user.id).sortBy('timestamp') : [], [user?.id]) ?? [];

  const filtered = events.filter(e => {
    if (filter === 'completed') return e.completed;
    if (filter === 'upcoming')  return !e.completed && new Date(e.timestamp) > new Date();
    if (filter === 'alerts')    return e.type === 'system_alert';
    return true;
  }).reverse();

  const addEvent = async () => {
    if (!user?.id || !newEvent.title || !newEvent.datetime) return;
    await db.events.add({ userId: user.id, timestamp: new Date(newEvent.datetime).toISOString(), type: newEvent.type as RecallEvent['type'], title: newEvent.title, description: newEvent.description || newEvent.title, completed: false, source: 'caregiver' });
    setShowForm(false);
    setNewEvent({ datetime: '', title: '', description: '', type: 'planned' });
  };

  const parseMessage = async () => {
    if (!user?.id || !caregiverMsg.trim()) return;
    setParsing(true);
    try {
      const parsed = await parseCaregiverMessage(caregiverMsg);
      const dt = parsed.time ? (() => { const d = new Date(); const [h, m] = parsed.time!.split(':'); d.setHours(+h, +m || 0, 0, 0); return d.toISOString(); })() : new Date().toISOString();
      await db.events.add({ userId: user.id, timestamp: dt, type: 'caregiver_input', title: parsed.title, description: parsed.description, completed: false, source: 'caregiver' });
      setCaregiverMsg('');
    } finally { setParsing(false); }
  };

  const colorFor = (e: RecallEvent) => e.completed ? 'var(--success)' : e.type === 'system_alert' ? 'var(--danger)' : 'var(--blue)';

  return (
    <div className="scroll-area">
      <div style={{ padding: '20px 20px 12px' }}>
        <div className="t-overline" style={{ marginBottom: 6, color: 'var(--warning)' }}>Supervisor</div>
        <div className="t-headline" style={{ fontSize: 22 }}>Event Stream</div>
      </div>

      {/* Quick add via message */}
      <div style={{ padding: '0 16px 12px' }}>
        <div className="card" style={{ padding: 16 }}>
          <div className="t-label" style={{ marginBottom: 10 }}>Add via message</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={caregiverMsg} onChange={e => setCaregiverMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && parseMessage()}
              placeholder="e.g. I'll visit at 6 PM" className="input" style={{ borderRadius: 12 }} />
            <button className="btn btn-primary btn-sm" style={{ borderRadius: 12, padding: '0 16px', flexShrink: 0 }} onClick={parseMessage} disabled={parsing}>
              {parsing ? '...' : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
            </button>
          </div>
        </div>
      </div>

      {/* Filter row */}
      <div style={{ padding: '0 16px 12px', display: 'flex', gap: 6, overflowX: 'auto' }}>
        {(['all','completed','upcoming','alerts'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            flexShrink: 0, padding: '6px 14px', borderRadius: 999, border: '1px solid var(--border)',
            cursor: 'pointer', fontFamily: 'Inter', fontSize: 12, fontWeight: 600,
            background: filter === f ? 'var(--blue)' : 'var(--surface)',
            color: filter === f ? 'white' : 'var(--muted-2)',
          }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <button onClick={() => setShowForm(v => !v)} style={{
          flexShrink: 0, marginLeft: 'auto', padding: '6px 14px', borderRadius: 999,
          border: '1px solid rgba(79,142,247,0.25)', cursor: 'pointer',
          fontFamily: 'Inter', fontSize: 12, fontWeight: 600,
          background: 'var(--blue-dim)', color: 'var(--blue)',
        }}>+ Add</button>
      </div>

      {/* Add form */}
      {showForm && (
        <div style={{ padding: '0 16px 12px' }}>
          <div className="card" style={{ padding: 16 }}>
            <div className="t-label" style={{ marginBottom: 12 }}>New Event</div>
            {[
              { ph: 'Date & Time', key: 'datetime', type: 'datetime-local' },
              { ph: 'Title', key: 'title', type: 'text' },
              { ph: 'Description (optional)', key: 'description', type: 'text' },
            ].map(f => (
              <input key={f.key} type={f.type} placeholder={f.ph}
                value={(newEvent as Record<string, string>)[f.key]}
                onChange={e => setNewEvent(p => ({ ...p, [f.key]: e.target.value }))}
                className="input" style={{ marginBottom: 8 }} />
            ))}
            <select value={newEvent.type} onChange={e => setNewEvent(p => ({ ...p, type: e.target.value }))}
              className="input" style={{ marginBottom: 12 }}>
              <option value="planned">Planned</option>
              <option value="caregiver_input">Caregiver Input</option>
              <option value="user_action">User Action</option>
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={addEvent}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Event list */}
      <div style={{ padding: '0 16px 16px' }}>
        <div className="card" style={{ overflow: 'hidden' }}>
          {filtered.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <p className="t-caption">No events found.</p>
            </div>
          )}
          {filtered.map((e, i) => (
            <div key={e.id} style={{ padding: '14px 16px', borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 3, alignSelf: 'stretch', background: colorFor(e), borderRadius: 4, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 14, color: 'var(--navy)', marginBottom: 3 }}>{e.title}</div>
                <div className="t-caption">{e.description}</div>
                <div className="t-caption" style={{ marginTop: 4, color: 'var(--muted)' }}>
                  {new Date(e.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {e.source}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                <div className={`chip ${e.completed ? 'chip-success' : e.type === 'system_alert' ? 'chip-danger' : 'chip-blue'}`}>
                  {e.completed ? 'Done' : 'Planned'}
                </div>
                <button onClick={() => e.id && db.events.delete(e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 11, fontFamily: 'Inter', fontWeight: 600 }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Medications ───────────────────────────────────────────────────────────────
function MedicationsTab({ user }: { user: User | null }) {
  const logs = useLiveQuery(() => user?.id ? db.medicationLogs.where('userId').equals(user.id).reverse().sortBy('timestamp') : [], [user?.id]) ?? [];

  return (
    <div className="scroll-area">
      <div style={{ padding: '20px 20px 12px' }}>
        <div className="t-overline" style={{ marginBottom: 6, color: 'var(--warning)' }}>Supervisor</div>
        <div className="t-headline" style={{ fontSize: 22 }}>Medication Log</div>
      </div>

      <div style={{ padding: '0 16px 16px' }}>
        {logs.length === 0 && (
          <div className="card" style={{ padding: 24, textAlign: 'center' }}>
            <p className="t-caption">No medication records yet.</p>
          </div>
        )}
        <div className="card" style={{ overflow: 'hidden' }}>
          {logs.map((l, i) => (
            <div key={l.id} style={{ padding: '14px 16px', borderBottom: i < logs.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className={`icon-box${l.confirmed ? '-blue' : ''}`} style={l.confirmed ? {} : { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={l.confirmed ? 'var(--blue)' : 'var(--danger)'} strokeWidth="2" strokeLinecap="round">
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0016.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 002 8.5c0 2.3 1.5 4.05 3 5.5l7 7z"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 14, color: 'var(--navy)' }}>{l.medicationName}</div>
                <div className="t-caption">{new Date(l.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                <div className="t-caption">{l.visionDescription}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <div className={`chip ${l.confirmed ? 'chip-success' : 'chip-danger'}`}>
                  <span className="chip-dot"/>{l.confirmed ? 'Confirmed' : 'Unconfirmed'}
                </div>
                <span className="t-caption" style={{ fontSize: 11 }}>{l.visionConfidence}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── ACSE ──────────────────────────────────────────────────────────────────────
function AcseTab({ user }: { user: User | null }) {
  const { acseScore } = useAppStore();
  const history = useLiveQuery(async () => {
    if (!user?.id) return [];
    const cutoff = new Date(Date.now() - 24 * 3600000).toISOString();
    return db.acseScores.where('userId').equals(user.id).and(s => s.timestamp > cutoff).sortBy('timestamp');
  }, [user?.id]) ?? [];

  const chartData = history.map(s => ({ time: new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), score: s.score }));
  const color = acseScore >= 75 ? 'var(--success)' : acseScore >= 50 ? 'var(--warning)' : 'var(--danger)';

  return (
    <div className="scroll-area">
      <div style={{ padding: '20px 20px 12px' }}>
        <div className="t-overline" style={{ marginBottom: 6, color: 'var(--warning)' }}>Supervisor</div>
        <div className="t-headline" style={{ fontSize: 22 }}>Cognitive Stability</div>
      </div>

      <div style={{ padding: '0 16px 12px' }}>
        <div className="card" style={{ padding: '20px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 16 }}>
            <div>
              <div className="t-label" style={{ marginBottom: 4 }}>Current ACSE Score</div>
              <div style={{ fontFamily: 'Inter', fontSize: 52, fontWeight: 800, color, lineHeight: 1 }}>{acseScore}</div>
            </div>
            <div style={{ marginBottom: 6 }}>
              <div className={`chip ${acseScore >= 75 ? 'chip-success' : acseScore >= 50 ? 'chip-warning' : 'chip-danger'}`}>
                <span className="chip-dot"/>{acseScore >= 75 ? 'Stable' : acseScore >= 50 ? 'Moderate' : 'Critical'}
              </div>
            </div>
          </div>

          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, color: 'var(--navy)' }} />
                <Line type="monotone" dataKey="score" stroke="var(--blue)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="t-caption" style={{ textAlign: 'center', padding: '20px 0' }}>Score history will appear here as events are recorded.</p>
          )}
        </div>
      </div>

      <div style={{ padding: '0 16px 16px' }}>
        <div className="t-label" style={{ marginBottom: 10 }}>Recent Changes</div>
        <div className="card" style={{ overflow: 'hidden' }}>
          {history.slice().reverse().slice(0, 10).map((s, i) => (
            <div key={s.id} style={{ padding: '12px 16px', borderBottom: i < Math.min(history.length, 10) - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 13, color: 'var(--navy)' }}>{s.reason ?? 'Score update'}</div>
                <div className="t-caption">{new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              <div style={{ fontFamily: 'Inter', fontSize: 24, fontWeight: 800, color: s.score >= 75 ? 'var(--success)' : s.score >= 50 ? 'var(--warning)' : 'var(--danger)' }}>{s.score}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Profile ───────────────────────────────────────────────────────────────────
function ProfileTab() {
  const { user, setUser } = useAppStore();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: user?.name ?? '', age: user?.age ?? 0, city: user?.city ?? '', caregiverName: user?.caregiverName ?? '', caregiverRelationship: user?.caregiverRelationship ?? '', familyPhotoUrl: user?.familyPhotoUrl ?? '' });
  const [meds, setMeds] = useState<Medication[]>(user?.medications ?? []);
  const [newMed, setNewMed] = useState({ name: '', dosage: '', schedule: '' });

  const save = async () => {
    if (!user?.id) return;
    const updated = { ...user, ...form, medications: meds, age: +form.age };
    await db.users.put(updated);
    setUser(updated);
    setEditing(false);
  };

  const addMed = () => {
    if (!newMed.name) return;
    setMeds(p => [...p, { name: newMed.name, dosage: newMed.dosage, schedule: newMed.schedule.split(',').map(s => s.trim()).filter(Boolean) }]);
    setNewMed({ name: '', dosage: '', schedule: '' });
  };

  return (
    <div className="scroll-area">
      <div style={{ padding: '20px 20px 12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="t-overline" style={{ marginBottom: 6, color: 'var(--warning)' }}>Supervisor</div>
          <div className="t-headline" style={{ fontSize: 22 }}>Patient Profile</div>
        </div>
        <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={editing ? save : () => setEditing(true)}>
          {editing ? 'Save' : 'Edit'}
        </button>
      </div>

      <div style={{ padding: '0 16px 12px' }}>
        <div className="card" style={{ overflow: 'hidden' }}>
          {editing ? (
            <div style={{ padding: 16 }}>
              {[
                { label: 'Full Name', key: 'name' }, { label: 'Age', key: 'age' },
                { label: 'Home City', key: 'city' }, { label: 'Caregiver Name', key: 'caregiverName' },
                { label: 'Relationship', key: 'caregiverRelationship' }, { label: 'Family Photo URL', key: 'familyPhotoUrl' },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: 12 }}>
                  <div className="t-label" style={{ marginBottom: 6 }}>{f.label}</div>
                  <input type={f.key === 'age' ? 'number' : 'text'}
                    value={(form as Record<string, string | number>)[f.key] as string}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="input" />
                </div>
              ))}
            </div>
          ) : (
            [['Name', form.name], ['Age', String(form.age)], ['City', form.city], ['Caregiver', `${form.caregiverName} (${form.caregiverRelationship})`]].map(([label, value]) => (
              <div key={label} className="list-row">
                <div style={{ flex: 1 }}>
                  <div className="t-label" style={{ marginBottom: 3 }}>{label}</div>
                  <div style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 15, color: 'var(--navy)' }}>{value || '—'}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ padding: '0 16px 16px' }}>
        <div className="t-label" style={{ marginBottom: 10 }}>Medications</div>
        <div className="card" style={{ overflow: 'hidden' }}>
          {meds.map((m, i) => (
            <div key={i} className="list-row">
              <div className="icon-box-blue">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2" strokeLinecap="round">
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0016.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 002 8.5c0 2.3 1.5 4.05 3 5.5l7 7z"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 14, color: 'var(--navy)' }}>{m.name}</div>
                <div className="t-caption">{m.dosage} · {m.schedule.join(', ')}</div>
              </div>
              {editing && (
                <button onClick={() => setMeds(p => p.filter((_, j) => j !== i))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontFamily: 'Inter', fontSize: 12, fontWeight: 600 }}>
                  Remove
                </button>
              )}
            </div>
          ))}

          {editing && (
            <div style={{ padding: 16, borderTop: '1px solid var(--border)' }}>
              <div className="t-label" style={{ marginBottom: 10 }}>Add Medication</div>
              {[{ ph: 'Name (e.g. Metformin)', key: 'name' }, { ph: 'Dosage (e.g. 500mg)', key: 'dosage' }, { ph: 'Schedule (e.g. 8:00 AM, 8:00 PM)', key: 'schedule' }].map(f => (
                <input key={f.key} placeholder={f.ph}
                  value={(newMed as Record<string, string>)[f.key]}
                  onChange={e => setNewMed(p => ({ ...p, [f.key]: e.target.value }))}
                  className="input" style={{ marginBottom: 8 }} />
              ))}
              <button className="btn btn-ghost btn-sm" style={{ width: '100%' }} onClick={addMed}>Add Medication</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
