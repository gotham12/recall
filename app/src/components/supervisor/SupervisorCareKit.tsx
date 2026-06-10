import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type EmergencyContact, type FamiliarFace, type RoutineTask } from '../../db/db';
import { useAppStore } from '../../store/appStore';
import StudioIcon from '../StudioIcon';

type KitTab = 'routines' | 'faces' | 'emergency';

export default function SupervisorCareKit() {
  const [tab, setTab] = useState<KitTab>('routines');
  const { user } = useAppStore();

  if (!user?.id) return null;

  return (
    <section className="care-kit card">
      <h3 className="studio-section-title">Care Kit — Routines, Faces & Safety</h3>
      <div className="care-kit__tabs">
        {(['routines', 'faces', 'emergency'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`studio-chip tap-feedback ${tab === t ? 'studio-chip--active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {tab === 'routines' && <RoutineEditor userId={user.id} />}
      {tab === 'faces' && <FacesEditor userId={user.id} />}
      {tab === 'emergency' && <EmergencyEditor userId={user.id} caregiver={user} />}
    </section>
  );
}

function RoutineEditor({ userId }: { userId: number }) {
  const [label, setLabel] = useState('');
  const [period, setPeriod] = useState<RoutineTask['period']>('morning');

  const tasks = useLiveQuery(
    () => db.routineTasks.where('userId').equals(userId).sortBy('sortOrder'),
    [userId]
  ) ?? [];

  const add = async () => {
    if (!label.trim()) return;
    await db.routineTasks.add({
      userId,
      label: label.trim(),
      period,
      sortOrder: tasks.length,
    });
    setLabel('');
  };

  const remove = async (id: number) => {
    await db.routineTasks.delete(id);
  };

  return (
    <div className="care-kit__panel">
      <div className="care-kit__form">
        <input className="studio-input" placeholder="Task label" value={label} onChange={(e) => setLabel(e.target.value)} />
        <select className="studio-select" value={period} onChange={(e) => setPeriod(e.target.value as RoutineTask['period'])}>
          <option value="morning">Morning</option>
          <option value="afternoon">Afternoon</option>
          <option value="evening">Evening</option>
        </select>
        <button type="button" className="studio-btn studio-btn--primary tap-feedback" onClick={() => void add()}>Add</button>
      </div>
      <ul className="care-kit__list">
        {tasks.map((t) => (
          <li key={t.id}>
            <span>{t.label} <em>({t.period})</em></span>
            <button type="button" className="studio-icon-btn tap-feedback" onClick={() => t.id && void remove(t.id)}>
              <StudioIcon name="close" size={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FacesEditor({ userId }: { userId: number }) {
  const [form, setForm] = useState({ name: '', relationship: '', photoUrl: '', memoryPrompt: '' });

  const faces = useLiveQuery(
    () => db.familiarFaces.where('userId').equals(userId).toArray(),
    [userId]
  ) ?? [];

  const add = async () => {
    if (!form.name.trim()) return;
    await db.familiarFaces.add({ userId, ...form, name: form.name.trim() });
    setForm({ name: '', relationship: '', photoUrl: '', memoryPrompt: '' });
  };

  const remove = async (id: number) => {
    await db.familiarFaces.delete(id);
  };

  return (
    <div className="care-kit__panel">
      <div className="care-kit__form care-kit__form--stack">
        <input className="studio-input" placeholder="Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
        <input className="studio-input" placeholder="Relationship" value={form.relationship} onChange={(e) => setForm((p) => ({ ...p, relationship: e.target.value }))} />
        <input className="studio-input" placeholder="Photo URL" value={form.photoUrl} onChange={(e) => setForm((p) => ({ ...p, photoUrl: e.target.value }))} />
        <textarea className="studio-textarea" placeholder="Memory prompt (spoken when tapped)" rows={2} value={form.memoryPrompt} onChange={(e) => setForm((p) => ({ ...p, memoryPrompt: e.target.value }))} />
        <button type="button" className="studio-btn studio-btn--primary tap-feedback" onClick={() => void add()}>Add face</button>
      </div>
      <ul className="care-kit__list">
        {faces.map((f: FamiliarFace) => (
          <li key={f.id}>
            <span>{f.name} — {f.relationship}</span>
            <button type="button" className="studio-icon-btn tap-feedback" onClick={() => f.id && void remove(f.id)}>
              <StudioIcon name="close" size={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmergencyEditor({
  userId,
  caregiver,
}: {
  userId: number;
  caregiver: { caregiverName: string; caregiverPhone?: string };
}) {
  const [form, setForm] = useState({ name: '', relationship: '', phone: '' });

  const contacts = useLiveQuery(
    () => db.emergencyContacts.where('userId').equals(userId).toArray(),
    [userId]
  ) ?? [];

  const add = async () => {
    if (!form.name.trim() || !form.phone.trim()) return;
    await db.emergencyContacts.add({ userId, ...form, name: form.name.trim(), phone: form.phone.trim() });
    setForm({ name: '', relationship: '', phone: '' });
  };

  const remove = async (id: number) => {
    await db.emergencyContacts.delete(id);
  };

  return (
    <div className="care-kit__panel">
      {caregiver.caregiverPhone && (
        <p className="studio-text-muted" style={{ fontSize: 14 }}>
          Primary: {caregiver.caregiverName} — {caregiver.caregiverPhone}
        </p>
      )}
      <div className="care-kit__form care-kit__form--stack">
        <input className="studio-input" placeholder="Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
        <input className="studio-input" placeholder="Relationship" value={form.relationship} onChange={(e) => setForm((p) => ({ ...p, relationship: e.target.value }))} />
        <input className="studio-input" placeholder="Phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
        <button type="button" className="studio-btn studio-btn--primary tap-feedback" onClick={() => void add()}>Add contact</button>
      </div>
      <ul className="care-kit__list">
        {contacts.map((c: EmergencyContact) => (
          <li key={c.id}>
            <span>{c.name} — {c.phone}</span>
            <button type="button" className="studio-icon-btn tap-feedback" onClick={() => c.id && void remove(c.id)}>
              <StudioIcon name="close" size={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
