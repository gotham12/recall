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
      const events = await db.events.where('userId').equals(user.id).toArray();

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
          (e) => `${e.title} at ${new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        ),
        upcomingEvents: upcoming.slice(0, 3).map(
          (e) => `${e.title} at ${new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        ),
      };

      const result = await reconstructState(user.name, user.city, user.caregiverName, ctx);
      setText(result);
    } catch (err) {
      console.error(err);
      const now = new Date();
      setText(
        `You are at home in ${user?.city ?? 'your home'}. It is ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} on ${now.toLocaleDateString([], { weekday: 'long' })}.`
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <div className="card" style={{ padding: '22px 18px', margin: '0 16px', position: 'relative', overflow: 'hidden' }}>
      <div className="studio-accent-line" />
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ fontSize: 24, marginTop: 2 }}>🌅</span>
        <div style={{ flex: 1 }}>
          <p className="studio-section-title" style={{ marginBottom: 8 }}>Right Now</p>
          {loading ? (
            <div>
              <div className="skeleton" style={{ height: 22, marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 22, width: '80%' }} />
            </div>
          ) : (
            <p className="studio-text-bright" style={{ fontSize: 20, lineHeight: 1.55, margin: 0 }}>
              {text}
            </p>
          )}
        </div>
      </div>
      <button
        onClick={refresh}
        className="studio-icon-btn"
        style={{ position: 'absolute', top: 14, right: 14 }}
        title="Refresh"
      >
        ↻
      </button>
    </div>
  );
}
