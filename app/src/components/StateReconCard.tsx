import { useEffect, useState, useCallback } from 'react';
import { db } from '../db/db';
import { reconstructState } from '../services/groq';
import { useAppStore } from '../store/appStore';

export default function StateReconCard() {
  const user = useAppStore((s) => s.user);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const events = await db.events
        .where('userId')
        .equals(user.id)
        .toArray();

      const completed = events
        .filter((e) => e.completed && new Date(e.timestamp) <= now)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const upcoming = events
        .filter((e) => !e.completed && new Date(e.timestamp) > now)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      const ctx = {
        lastCompleted: completed[0]?.title,
        nextPlanned: upcoming[0]?.title,
        recentEvents: completed.slice(0, 5).map(
          (e) =>
            `${e.title} at ${new Date(e.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}`
        ),
        upcomingEvents: upcoming.slice(0, 3).map(
          (e) =>
            `${e.title} at ${new Date(e.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}`
        ),
      };

      const result = await reconstructState(
        user.name,
        user.city,
        user.caregiverName,
        ctx
      );
      setText(result);
    } catch (err) {
      console.error(err);
      const now = new Date();
      setText(
        `You are at home in ${user?.city ?? 'your home'}. It is ${now.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })} on ${now.toLocaleDateString([], { weekday: 'long' })}.`
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <div
      className="card"
      style={{
        padding: '24px 20px',
        margin: '0 16px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle electric accent line */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: 'linear-gradient(90deg, #2196F3, #0057CC)',
          borderRadius: '20px 20px 0 0',
        }}
      />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ fontSize: 28, marginTop: 2 }}>🌅</span>
        <div style={{ flex: 1 }}>
          <p
            style={{
              fontSize: 13,
              color: '#2196F3',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              margin: '0 0 8px',
            }}
          >
            Right Now
          </p>

          {loading ? (
            <div>
              <div className="skeleton" style={{ height: 24, marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 24, width: '80%' }} />
            </div>
          ) : (
            <p
              style={{
                fontSize: 22,
                color: '#1A2B4A',
                lineHeight: 1.5,
                margin: 0,
                fontWeight: 500,
              }}
            >
              {text}
            </p>
          )}
        </div>
      </div>

      <button
        onClick={refresh}
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#2196F3',
          fontSize: 20,
          padding: 4,
          opacity: 0.7,
        }}
        title="Refresh"
      >
        ↻
      </button>
    </div>
  );
}
