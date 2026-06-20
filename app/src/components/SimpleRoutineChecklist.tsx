import { useState, useEffect } from 'react';
import StudioIcon from './StudioIcon';

interface RoutineEvent {
  id: string;
  name: string;
  time: string;
}

interface CompletionMap {
  [id: string]: boolean;
}

const DEFAULT_EVENTS: RoutineEvent[] = [
  { id: 'morning-med',  name: 'Morning Medication',  time: '8:00 AM' },
  { id: 'breakfast',    name: 'Breakfast',            time: '8:30 AM' },
  { id: 'morning-walk', name: 'Morning Walk',         time: '9:30 AM' },
  { id: 'lunch',        name: 'Lunch',                time: '12:30 PM' },
  { id: 'afternoon-rest', name: 'Afternoon Rest',     time: '2:00 PM' },
  { id: 'evening-med',  name: 'Evening Medication',   time: '6:00 PM' },
  { id: 'dinner',       name: 'Dinner',               time: '7:00 PM' },
  { id: 'bedtime',      name: 'Bedtime',              time: '9:30 PM' },
];

const EVENTS_KEY = 'recall_routine_events';
const todayKey = () => `recall_routine_done_${new Date().toDateString()}`;

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

function loadCompletions(): CompletionMap {
  try {
    const raw = localStorage.getItem(todayKey());
    if (raw) return JSON.parse(raw) as CompletionMap;
  } catch { /* ignore */ }
  return {};
}

function saveCompletions(map: CompletionMap) {
  localStorage.setItem(todayKey(), JSON.stringify(map));
}

export default function SimpleRoutineChecklist() {
  const [events, setEvents] = useState<RoutineEvent[]>(loadEvents);
  const [done, setDone] = useState<CompletionMap>(loadCompletions);

  useEffect(() => {
    const handler = () => setEvents(loadEvents());
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const toggle = (id: string) => {
    const updated = { ...done, [id]: !done[id] };
    setDone(updated);
    saveCompletions(updated);
  };

  const completedCount = events.filter(e => done[e.id]).length;
  const progress = events.length > 0 ? (completedCount / events.length) * 100 : 0;

  return (
    <div className="studio-scroll simple-routine" style={{ padding: '16px 16px 40px' }}>
      <h2 className="studio-page-title" style={{ marginBottom: 4 }}>Daily Routine</h2>
      <p style={{ fontSize: 14, color: 'var(--studio-text-muted)', marginBottom: 16 }}>
        {new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
      </p>

      {/* Progress bar */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--studio-text-bright)' }}>
            {completedCount} of {events.length} completed
          </span>
          <span style={{ fontSize: 13, color: 'var(--studio-accent)', fontWeight: 700 }}>
            {Math.round(progress)}%
          </span>
        </div>
        <div style={{
          height: 8, borderRadius: 8,
          background: 'var(--studio-progress-track)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: 'linear-gradient(90deg, var(--fm-blue-deep, #2E6DB4), var(--fm-blue, #4A90D9))',
            borderRadius: 8,
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      {/* Checklist */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {events.map((event) => {
          const isChecked = !!done[event.id];
          return (
            <button
              key={event.id}
              type="button"
              onClick={() => toggle(event.id)}
              aria-pressed={isChecked}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                minHeight: 60,
                padding: '12px 16px',
                borderRadius: 16,
                border: `1.5px solid ${isChecked ? 'rgba(76,175,80,0.30)' : 'var(--studio-card-border)'}`,
                background: isChecked
                  ? 'rgba(76,175,80,0.08)'
                  : 'var(--studio-surface)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.25s ease, border-color 0.25s ease',
              }}
              className="tap-feedback"
            >
              {/* Checkbox */}
              <span style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isChecked ? '#4CAF50' : 'transparent',
                border: `2px solid ${isChecked ? '#4CAF50' : 'var(--studio-border)'}`,
                transition: 'all 0.2s ease',
                color: '#fff',
              }}>
                {isChecked && <StudioIcon name="check" size={16} />}
              </span>

              {/* Label */}
              <span style={{ flex: 1 }}>
                <span style={{
                  display: 'block',
                  fontSize: 16,
                  fontWeight: 600,
                  color: isChecked ? 'var(--studio-text-muted)' : 'var(--studio-text-bright)',
                  textDecoration: isChecked ? 'line-through' : 'none',
                  transition: 'color 0.2s ease',
                }}>
                  {event.name}
                </span>
                {event.time && (
                  <span style={{
                    fontSize: 13,
                    color: 'var(--studio-text-muted)',
                    marginTop: 2,
                    display: 'block',
                  }}>
                    {event.time}
                  </span>
                )}
              </span>

              {isChecked && (
                <span style={{ color: '#4CAF50', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>Done ✓</span>
              )}
            </button>
          );
        })}
      </div>

      {completedCount === events.length && events.length > 0 && (
        <div style={{
          marginTop: 24, padding: '16px 20px', borderRadius: 16,
          background: 'rgba(76,175,80,0.10)',
          border: '1.5px solid rgba(76,175,80,0.25)',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: '#4CAF50', margin: '0 0 4px' }}>
            All done! 🌸
          </p>
          <p style={{ fontSize: 14, color: 'var(--studio-text-muted)', margin: 0 }}>
            Wonderful job completing your routine today.
          </p>
        </div>
      )}
    </div>
  );
}
