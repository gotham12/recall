import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import HomeIconGrid from '../components/HomeIconGrid';
import RoutineManager from '../components/RoutineManager';
import {
  ComposedChart, AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ReferenceArea, Brush, Legend, Cell,
} from 'recharts';
import StudioShell from '../components/StudioShell';
import RecallLogo from '../components/RecallLogo';
import StudioIcon, { type IconName } from '../components/StudioIcon';
import { getFlowers, type FlowerKey } from '../flowers';
import ThemeToggle from '../components/ThemeToggle';
import VitalsDashboard from '../components/VitalsDashboard';
import { addMedication, removeMedication, replaceMedication } from '../lib/medications';
import type { Medication } from '../db/db';
import StormRadar from '../components/StormRadar';
import CareJournal from '../components/CareJournal';
import DataExportPanel from '../components/DataExportPanel';
import CareCommandCenter from '../components/supervisor/CareCommandCenter';
import ACSESignalAudit from '../components/supervisor/ACSESignalAudit';
import CareSettingsPanel from '../components/supervisor/CareSettingsPanel';
import LiveActivityFeed from '../components/supervisor/LiveActivityFeed';
import MedicationAdherence from '../components/supervisor/MedicationAdherence';
import SupervisorCareKit from '../components/supervisor/SupervisorCareKit';
import WeeklyInsights from '../components/supervisor/WeeklyInsights';
import AlertHistory from '../components/supervisor/AlertHistory';
import { logout } from '../lib/session';
import { useAppStore } from '../store/appStore';
import SettingsSheet from '../components/SettingsSheet';
import { db, type Event, type User } from '../db/db';

type Tab = 'home' | 'events' | 'medications' | 'stats' | 'profile' | 'routine';

const TAB_FLOWER_KEYS: Record<Tab, FlowerKey> = {
  home: 'supervisorApp',
  events: 'landing',
  medications: 'patientEnter',
  stats: 'supervisor',
  profile: 'home',
  routine: 'supervisorApp',
};

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'home',        label: 'Home',    icon: 'home' },
  { id: 'events',      label: 'Events',  icon: 'events' },
  { id: 'medications', label: 'Meds',    icon: 'meds' },
  { id: 'routine',     label: 'Routine', icon: 'routine' },
  { id: 'stats',       label: 'Stats',   icon: 'score' },
];

const SUP_FEATURE_LABELS: Record<string, string> = {
  home:        'Overview',
  events:      'Alerts & Events',
  medications: 'Medications',
  routine:     'Routine',
  stats:       'Stats',
  journal:     'Care Journal',
};

export default function SupervisorView() {
  const [activeFeature, setActiveFeature] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { user, supervisorAlerts, clearSupervisorAlert } = useAppStore();
  const setScreen = useAppStore((s) => s.setScreen);

  const firstName = user?.name?.split(' ')[0] ?? 'Supervisor';

  const openFeature = (id: string) => setActiveFeature(id);
  const goHome = () => setActiveFeature(null);

  // ── visionOS home grid ──────────────────────────────────────────────────────
  if (!activeFeature) {
    return (
      <>
        <HomeIconGrid
          role="supervisor"
          userName={`Hi, ${firstName}`}
          onSelect={openFeature}
          onSwitchRole={() => setScreen('login')}
        />
        <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
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
        <span className="vis-feature-title">{SUP_FEATURE_LABELS[activeFeature] ?? activeFeature}</span>
        <button className="studio-icon-btn tap-feedback" onClick={() => setSettingsOpen(true)} aria-label="Settings"
          style={{ marginLeft: 'auto' }}>
          <StudioIcon name="settings" size={18} />
        </button>
      </div>

      {supervisorAlerts.length > 0 && (
        <div className="alert-banner" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px' }}>
          <StudioIcon name="alert" size={18} />
          <span style={{ flex: 1, fontSize: 14 }}>{supervisorAlerts[0].message}</span>
          <button onClick={() => clearSupervisorAlert(supervisorAlerts[0].id)}
            className="studio-icon-btn tap-feedback" aria-label="Dismiss">
            <StudioIcon name="close" size={14} />
          </button>
        </div>
      )}

      <div className="vis-feature-content studio-scroll">
        {activeFeature === 'home'        && <SupervisorHomeTab user={user} />}
        {activeFeature === 'events'      && <EventsTab user={user} />}
        {activeFeature === 'medications' && <MedicationsTab user={user} />}
        {activeFeature === 'routine'     && <RoutineManager />}
        {activeFeature === 'stats'       && <StatsTab user={user} />}
        {activeFeature === 'journal'     && <div className="vis-feature-scroll-inner"><CareJournal /></div>}
      </div>

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

// ── Supervisor Home ───────────────────────────────────────────────────────────
function SupervisorHomeTab({ user }: { user: User | null }) {
  const { acseScore } = useAppStore();
  const [quickTitle, setQuickTitle] = useState('');
  const [quickTime, setQuickTime] = useState('');
  const [saved, setSaved] = useState(false);

  const eventCount = useLiveQuery<number>(
    () => user?.id ? db.events.where('userId').equals(user.id).count() : Promise.resolve(0),
    [user?.id]
  ) ?? 0;
  const medCount = useLiveQuery<number>(
    () => user?.id ? db.medicationLogs.where('userId').equals(user.id).count() : Promise.resolve(0),
    [user?.id]
  ) ?? 0;

  const handleQuickEvent = async () => {
    if (!user?.id || !quickTitle.trim()) return;
    const ts = quickTime ? new Date(quickTime).toISOString() : new Date().toISOString();
    await db.events.add({
      userId: user.id,
      timestamp: ts,
      type: 'planned',
      title: quickTitle.trim(),
      description: quickTitle.trim(),
      completed: false,
      source: 'caregiver',
    });
    setQuickTitle('');
    setQuickTime('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="supervisor-home studio-scroll">
      <CareCommandCenter />

      <LiveActivityFeed limit={6} />

      <StormRadar userId={user?.id} />

      <CareJournal />

      <div className="card quick-event-card">
        <p className="studio-section-title">Add event now</p>
        <input
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          placeholder="Event title, e.g. Doctor visit"
          className="studio-input"
          style={{ marginBottom: 8 }}
        />
        <input
          type="datetime-local"
          value={quickTime}
          onChange={(e) => setQuickTime(e.target.value)}
          className="studio-input"
          style={{ marginBottom: 10 }}
        />
        <button className="studio-btn studio-btn--primary tap-feedback" style={{ width: '100%' }} onClick={handleQuickEvent}>
          {saved ? 'Event added ✓' : 'Save Event'}
        </button>
      </div>

      <div className="stat-grid">
        {[
          { label: 'ACSE', value: acseScore },
          { label: 'Events', value: eventCount },
          { label: 'Med logs', value: medCount },
        ].map((stat) => (
          <div key={stat.label} className="card stat-grid__item">
            <p className="studio-stat-value">{stat.value}</p>
            <p className="studio-stat-label">{stat.label}</p>
          </div>
        ))}
      </div>

      {user && (
        <div className="card supervisor-profile">
          <p className="studio-section-title">Patient profile</p>
          <p className="supervisor-profile__name">{user.name}</p>
          <p className="supervisor-profile__meta">Age {user.age} · {user.city}</p>
          <p className="supervisor-profile__meta">
            Caregiver: {user.caregiverName} ({user.caregiverRelationship})
          </p>
        </div>
      )}
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
    <div className="events-tab studio-scroll">
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
            opacity: e.type === 'system_alert' ? 1 : 1,
            borderLeft: e.type === 'system_alert' ? '3px solid rgba(180,40,40,0.22)' : e.completed ? '3px solid rgba(0,0,0,0.10)' : '3px solid rgba(0,0,0,0.10)',
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
    <div className="supervisor-meds studio-scroll">
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

// ── Stats Tab (vitals + ACSE) ─────────────────────────────────────────────────
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
    <div className="stats-tab studio-scroll">
      <VitalsDashboard patientName={user?.name} />
      <ACSESignalAudit />
      <WeeklyInsights />

      <h2 className="studio-page-title" style={{ marginTop: 8 }}>ACSE — Cognitive Score</h2>

      {/* Score summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
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

// ── Profile Tab ───────────────────────────────────────────────────────────────
function ProfileTab() {
  const { user, setUser } = useAppStore();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: user?.name ?? '',
    age: user?.age ?? 0,
    city: user?.city ?? '',
    homeAddress: user?.homeAddress ?? '',
    caregiverName: user?.caregiverName ?? '',
    caregiverRelationship: user?.caregiverRelationship ?? '',
    caregiverPhone: user?.caregiverPhone ?? '',
    familyPhotoUrl: user?.familyPhotoUrl ?? '',
    emergencyNote: user?.emergencyNote ?? '',
    calmingMusicUrl: user?.calmingMusicUrl ?? '',
  });

  const handleSave = async () => {
    if (!user?.id) return;
    const updated = { ...user, ...form };
    await db.users.put(updated);
    setUser(updated);
    setEditing(false);
  };

  const Field = ({
    label, value, onChange, type = 'text',
  }: {
    label: string; value: string; onChange: (v: string) => void; type?: string;
  }) => (
    <div style={{ marginBottom: 12 }}>
      <p className="studio-field-label">{label}</p>
      {editing ? (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="studio-input"
        />
      ) : (
        <p className="studio-field-value">{value || '—'}</p>
      )}
    </div>
  );

  return (
    <div className="profile-tab studio-scroll">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 className="studio-page-title" style={{ margin: 0 }}>Patient Profile</h2>
        <button
          onClick={() => editing ? handleSave() : setEditing(true)}
          className={`studio-btn tap-feedback ${editing ? 'studio-btn--primary' : ''}`}
          style={{ padding: '8px 16px', fontSize: 15 }}
        >
          {editing ? 'Save' : 'Edit'}
        </button>
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <Field label="Full Name" value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} />
        <Field label="Age" value={String(form.age)} onChange={(v) => setForm((p) => ({ ...p, age: parseInt(v) || 0 }))} type="number" />
        <Field label="Home City" value={form.city} onChange={(v) => setForm((p) => ({ ...p, city: v }))} />
        <Field label="Caregiver Name" value={form.caregiverName} onChange={(v) => setForm((p) => ({ ...p, caregiverName: v }))} />
        <Field label="Relationship" value={form.caregiverRelationship} onChange={(v) => setForm((p) => ({ ...p, caregiverRelationship: v }))} />
        <Field label="Caregiver Phone" value={form.caregiverPhone} onChange={(v) => setForm((p) => ({ ...p, caregiverPhone: v }))} />
        <Field label="Home Address" value={form.homeAddress} onChange={(v) => setForm((p) => ({ ...p, homeAddress: v }))} />
        <Field label="Family Photo URL" value={form.familyPhotoUrl} onChange={(v) => setForm((p) => ({ ...p, familyPhotoUrl: v }))} />
        <Field label="Emergency Note" value={form.emergencyNote} onChange={(v) => setForm((p) => ({ ...p, emergencyNote: v }))} />
        <Field label="Calming Music URL" value={form.calmingMusicUrl} onChange={(v) => setForm((p) => ({ ...p, calmingMusicUrl: v }))} />
      </div>

      <CareSettingsPanel />
      <SupervisorCareKit />
      <AlertHistory />
      <DataExportPanel />

      {user?.medications && (
        <div className="card" style={{ padding: 20 }}>
          <p style={{ fontSize: 14, color: '#8A9AB0', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 12px' }}>
            Medications
          </p>
          {user.medications.map((m, i) => (
            <div key={i} className="card" style={{ marginBottom: 12, padding: '10px 12px' }}>
              <p className="studio-text-bright" style={{ fontSize: 17, fontWeight: 600, margin: '0 0 2px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <StudioIcon name="meds" size={16} />
                {m.name}
              </p>
              <p className="studio-text-muted" style={{ fontSize: 15, margin: 0 }}>{m.dosage} · {m.schedule.join(', ')}</p>
            </div>
          ))}
          <p className="studio-text-muted" style={{ fontSize: 14, margin: '8px 0 0' }}>
            Add, edit, or remove medications in the Meds tab.
          </p>
        </div>
      )}
    </div>
  );
}
