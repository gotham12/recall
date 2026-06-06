import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import { db } from '../db/db';
import { reconstructState } from '../services/groq';

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
      const completed = events.filter(e => e.completed && new Date(e.timestamp) <= now)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      const upcoming = events.filter(e => !e.completed && new Date(e.timestamp) > now)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const ctx = {
        recentEvents:   completed.slice(0, 5).map(e => `${e.title} at ${new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`),
        upcomingEvents: upcoming.slice(0, 3).map(e => `${e.title} at ${new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`),
      };
      setText(await reconstructState(user.name, user.city, user.caregiverName, ctx));
    } catch {
      const now = new Date();
      setText(`You are at home in ${user?.city ?? 'your home'}. It is ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} on ${now.toLocaleDateString([], { weekday: 'long' })}.`);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
      {/* Top accent */}
      <div style={{ height: 2, background: 'linear-gradient(90deg, var(--green) 0%, rgba(34,197,94,0.3) 60%, transparent 100%)' }} />

      <div style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div className="t-overline" style={{ color: 'var(--green)' }}>Reality Check</div>
          <div style={{ flex: 1 }} />
          <button onClick={refresh} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 8px', cursor: 'pointer', color: 'var(--muted-2)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
            </svg>
            <span style={{ fontFamily: 'Inter', fontSize: 11, fontWeight: 600 }}>Refresh</span>
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="skeleton" style={{ height: 16, borderRadius: 6 }} />
            <div className="skeleton" style={{ height: 16, width: '85%', borderRadius: 6 }} />
            <div className="skeleton" style={{ height: 16, width: '70%', borderRadius: 6 }} />
          </div>
        ) : (
          <p style={{ fontFamily: 'Inter', fontSize: 15, lineHeight: 1.7, color: 'var(--navy)', fontWeight: 400, margin: 0 }}>{text}</p>
        )}
      </div>
    </div>
  );
}
