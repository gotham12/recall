import { useState, useEffect } from 'react';
import BreathingCircle from '../components/BreathingCircle';
import FlowerStage from '../components/FlowerStage';
import { FLOWERS } from '../flowers';
import { useAppStore } from '../store/appStore';
import { generateGrounding, generateNarrative } from '../services/groq';
import { speak } from '../services/elevenlabs';
import { db } from '../db/db';

type Phase = 'grounding' | 'breathing' | 'narrative' | 'done';

export default function ComfortMode() {
  const { user, deactivateComfortMode } = useAppStore();
  const [phase, setPhase] = useState<Phase>('grounding');
  const [groundingText, setGroundingText] = useState('');
  const [narrativeText, setNarrativeText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      if (!user?.id) return;
      setLoading(true);

      const events = await db.events
        .where('userId').equals(user.id)
        .and((e) => e.completed)
        .toArray();

      const ctx = {
        recentEvents: events
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 5)
          .map((e) => e.title),
        upcomingEvents: [],
      };

      try {
        const grounding = await generateGrounding(user.name, user.city, ctx);
        setGroundingText(grounding);
        await speak(grounding);

        const narrative = await generateNarrative(user.name, ctx.recentEvents);
        setNarrativeText(narrative);
      } catch {
        setGroundingText(
          `You are safe at home in ${user?.city ?? 'your home'}. Everything is okay. Take a slow breath.`
        );
        setNarrativeText('Today has been a calm day. You are resting comfortably at home.');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [user]);

  const handleBreathingComplete = async () => {
    await speak(narrativeText);
    setPhase('narrative');
  };

  return (
    <div className="studio-screen" style={{ zIndex: 50 }}>
      <FlowerStage src={FLOWERS.comfort} glowIntensity={1.1} />
      <div
        className="studio-app-scrim"
        style={{ background: 'rgba(0,0,0,0.62)', zIndex: 2 }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 5,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--sat) 24px var(--sab)',
        }}
      >
        {phase === 'grounding' && (
          <div className="animate-fadeIn card" style={{ maxWidth: 400, padding: 28, textAlign: 'center' }}>
            {loading ? (
              <div>
                <div className="skeleton" style={{ height: 24, marginBottom: 8, width: '80%', margin: '0 auto 8px' }} />
                <div className="skeleton" style={{ height: 24, width: '60%', margin: '0 auto' }} />
              </div>
            ) : (
              <>
                <p className="studio-text-bright" style={{ fontSize: 22, lineHeight: 1.6, marginBottom: 28 }}>
                  {groundingText}
                </p>
                <button
                  className="studio-btn studio-btn--primary tap-feedback"
                  onClick={() => { speak("Let's do some breathing together."); setPhase('breathing'); }}
                >
                  Let's breathe together
                </button>
              </>
            )}
          </div>
        )}

        {phase === 'breathing' && (
          <div className="animate-fadeIn card" style={{ maxWidth: 400, width: '100%', padding: 28, textAlign: 'center' }}>
            <p className="studio-text-bright" style={{ fontSize: 20, marginBottom: 8 }}>
              Breathe with me, {user?.name?.split(' ')[0]}
            </p>
            <BreathingCircle cycles={3} onComplete={handleBreathingComplete} />
          </div>
        )}

        {phase === 'narrative' && (
          <div className="animate-fadeIn card" style={{ maxWidth: 400, padding: 28, textAlign: 'center' }}>
            <p className="studio-text-bright" style={{ fontSize: 20, lineHeight: 1.6, marginBottom: 28 }}>
              {narrativeText}
            </p>
            <button className="studio-btn studio-btn--primary tap-feedback" onClick={deactivateComfortMode}>
              I'm feeling better
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
