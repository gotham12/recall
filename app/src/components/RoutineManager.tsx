import { useState, useEffect } from 'react';
import StudioIcon from './StudioIcon';

interface RoutineEvent {
  id: string;
  name: string;
  time: string;
}

const EVENTS_KEY = 'recall_routine_events';

const DEFAULT_EVENTS: RoutineEvent[] = [
  { id: 'morning-med',    name: 'Morning Medication',  time: '8:00 AM' },
  { id: 'breakfast',      name: 'Breakfast',           time: '8:30 AM' },
  { id: 'morning-walk',   name: 'Morning Walk',        time: '9:30 AM' },
  { id: 'lunch',          name: 'Lunch',               time: '12:30 PM' },
  { id: 'afternoon-rest', name: 'Afternoon Rest',      time: '2:00 PM' },
  { id: 'evening-med',    name: 'Evening Medication',  time: '6:00 PM' },
  { id: 'dinner',         name: 'Dinner',              time: '7:00 PM' },
  { id: 'bedtime',        name: 'Bedtime',             time: '9:30 PM' },
];

function loadEvents(): RoutineEvent[] {
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as RoutineEvent[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return DEFAULT_EVENTS;
}

function saveEvents(events: RoutineEvent[]) {
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
  window.dispatchEvent(new Event('storage'));
}

function uid() {
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function RoutineManager() {
  const [events, setEvents] = useState<RoutineEvent[]>(loadEvents);

  useEffect(() => {
    const handler = () => setEvents(loadEvents());
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const update = (id: string, field: keyof RoutineEvent, value: string) => {
    const updated = events.map(e => e.id === id ? { ...e, [field]: value } : e);
    setEvents(updated);
    saveEvents(updated);
  };

  const remove = (id: string) => {
    const updated = events.filter(e => e.id !== id);
    setEvents(updated);
    saveEvents(updated);
  };

  const add = () => {
    const newEvent: RoutineEvent = { id: uid(), name: 'New Event', time: '' };
    const updated = [...events, newEvent];
    setEvents(updated);
    saveEvents(updated);
  };

  return (
    <div className="studio-scroll" style={{ padding: '16px 16px 40px' }}>
      <h2 className="studio-page-title" style={{ marginBottom: 4 }}>Patient Routine</h2>
      <p style={{ fontSize: 14, color: 'var(--studio-text-muted)', marginBottom: 20 }}>
        Changes are saved instantly and visible to the patient.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {events.map((event) => (
          <div
            key={event.id}
            className="card"
            style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}
          >
            {/* Time */}
            <input
              type="text"
              value={event.time}
              onChange={e => update(event.id, 'time', e.target.value)}
              placeholder="Time"
              className="studio-input"
              style={{
                width: 90,
                flexShrink: 0,
                padding: '8px 10px',
                fontSize: 14,
                margin: 0,
              }}
              aria-label="Event time"
            />

            {/* Name */}
            <input
              type="text"
              value={event.name}
              onChange={e => update(event.id, 'name', e.target.value)}
              placeholder="Event name"
              className="studio-input"
              style={{
                flex: 1,
                padding: '8px 12px',
                fontSize: 15,
                margin: 0,
              }}
              aria-label="Event name"
            />

            {/* Delete */}
            <button
              type="button"
              className="studio-icon-btn tap-feedback"
              onClick={() => remove(event.id)}
              aria-label={`Remove ${event.name}`}
              style={{ color: 'rgba(180,40,40,0.6)', flexShrink: 0 }}
            >
              <StudioIcon name="close" size={18} />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="studio-btn studio-btn--primary tap-feedback"
        onClick={add}
        style={{ marginTop: 16, width: '100%', justifyContent: 'center' }}
      >
        + Add Event
      </button>

      <button
        type="button"
        className="studio-btn tap-feedback"
        onClick={() => { setEvents(DEFAULT_EVENTS); saveEvents(DEFAULT_EVENTS); }}
        style={{ marginTop: 10, width: '100%', justifyContent: 'center', fontSize: 13 }}
      >
        Reset to defaults
      </button>
    </div>
  );
}
