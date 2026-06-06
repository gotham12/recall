import { useState, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { generateGrounding, generateNarrative } from '../services/groq';
import { speak } from '../services/elevenlabs';
import { db } from '../db/db';
import BreathingCircle from '../components/BreathingCircle';

type Phase = 'grounding' | 'breathing' | 'narrative' | 'done';

export default function ComfortMode() {
  const { user, deactivateComfortMode } = useAppStore();
  const [phase, setPhase] = useState<Phase>('grounding');
  const [grounding, setGrounding] = useState('');
  const [narrative, setNarrative] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!user?.id) return;
      setLoading(true);
      const events = await db.events.where('userId').equals(user.id).and(e => e.completed).toArray();
      const recent = events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5).map(e => e.title);
      const ctx = { recentEvents: recent, upcomingEvents: [] };
      try {
        const [g, n] = await Promise.all([
          generateGrounding(user.name, user.city, ctx),
          generateNarrative(user.name, recent),
        ]);
        setGrounding(g); setNarrative(n);
        await speak(g);
      } catch {
        setGrounding(`You are safe at home in ${user?.city}. Everything is okay. Take a slow breath.`);
        setNarrative('Today has been a calm day. You are resting comfortably at home.');
      } finally { setLoading(false); }
    })();
  }, [user]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(175deg,#EBF5FF 0%,#F8F5F0 100%)', zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', paddingTop: 'var(--sat)', paddingBottom: 'var(--sab)' }}>
      <div className="blob blob-a" style={{ opacity: .08 }} />

      <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: 420, padding: '0 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>

        {/* Family photo */}
        {user?.familyPhotoUrl ? (
          <img src={user.familyPhotoUrl} alt="Family" style={{ width: 90, height: 90, borderRadius: '50%', objectFit: 'cover', border: '4px solid white', boxShadow: '0 4px 24px rgba(14,122,230,0.2)' }} />
        ) : (
          <div style={{ width: 90, height: 90, borderRadius: '50%', background: 'linear-gradient(135deg,#A8D8FF,var(--blue))', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '4px solid white', boxShadow: '0 4px 24px rgba(14,122,230,0.25)' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
            </svg>
          </div>
        )}

        {/* Grounding phase */}
        {phase === 'grounding' && (
          <div style={{ textAlign: 'center' }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="skeleton" style={{ height: 22 }}/><div className="skeleton" style={{ height: 22, width: '75%', margin: '0 auto' }}/>
              </div>
            ) : (
              <>
                <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 24, fontWeight: 600, color: 'var(--navy)', lineHeight: 1.55, marginBottom: 28 }}>{grounding}</p>
                <button className="btn btn-primary" style={{ width: '100%', padding: 20, fontSize: 18 }} onClick={() => { speak("Let's do some breathing together.").catch(console.error); setPhase('breathing'); }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round"><path d="M9.59 4.59A2 2 0 1111 8H2m10.59 11.41A2 2 0 1013 16H2m15.73-8.27A2.5 2.5 0 1119.5 12H2"/></svg>
                  Let's breathe together
                </button>
              </>
            )}
          </div>
        )}

        {/* Breathing phase */}
        {phase === 'breathing' && (
          <div style={{ width: '100%', textAlign: 'center' }}>
            <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 20, fontWeight: 700, color: 'var(--navy)', marginBottom: 16 }}>
              Breathe with me, {user?.name?.split(' ')[0]}
            </p>
            <BreathingCircle cycles={3} onComplete={async () => { await speak(narrative); setPhase('narrative'); }} />
          </div>
        )}

        {/* Narrative phase */}
        {phase === 'narrative' && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 22, fontWeight: 600, color: 'var(--navy)', lineHeight: 1.6, marginBottom: 28 }}>{narrative}</p>
            <button className="btn btn-success" style={{ width: '100%', padding: 20, fontSize: 18 }} onClick={deactivateComfortMode}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              I'm feeling better
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
