import { useState, useEffect } from 'react';
import BreathingCircle from '../components/BreathingCircle';
import CalmingMusicPlayer from '../components/CalmingMusicPlayer';
import RecallCascade from '../components/RecallCascade';
import CaregiverMirror from '../components/CaregiverMirror';
import FlowerStage from '../components/FlowerStage';
import StudioIcon from '../components/StudioIcon';
import { getFlowers } from '../flowers';
import { useAppStore } from '../store/appStore';
import { generateGrounding, generateNarrative } from '../services/groq';
import { speak, stopSpeaking } from '../services/elevenlabs';
import { db } from '../db/db';

type Phase = 'grounding' | 'breathing' | 'narrative' | 'done';

export default function ComfortMode() {
  const { user, deactivateComfortMode, theme } = useAppStore();
  const flowers = getFlowers(theme);
  const [phase, setPhase] = useState<Phase>('grounding');
  const [groundingText, setGroundingText] = useState('');
  const [narrativeText, setNarrativeText] = useState('');
  const [loading, setLoading] = useState(true);

  const exitComfort = () => {
    stopSpeaking();
    deactivateComfortMode();
  };

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
        upcomingEvents: [] as string[],
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

    return () => stopSpeaking();
  }, [user]);

  const handleBreathingComplete = async () => {
    await speak(narrativeText);
    setPhase('narrative');
  };

  const skipToNarrative = async () => {
    stopSpeaking();
    await speak(narrativeText);
    setPhase('narrative');
  };

  const caregiverLabel = user?.caregiverName
    ? `Call ${user.caregiverName}`
    : 'Call caregiver';

  return (
    <div className="studio-screen comfort-mode" style={{ zIndex: 50 }}>
      <FlowerStage
        key={`${theme}-comfort`}
        src={flowers.comfort}
        glowIntensity={1.1}
        variant="app"
      />
      <div className="studio-app-scrim comfort-mode__scrim" />

      <RecallCascade />
      <CaregiverMirror />

      <div className="comfort-mode__content">
        <button
          type="button"
          className="comfort-mode__close tap-feedback"
          onClick={exitComfort}
          aria-label="Exit comfort mode"
        >
          <StudioIcon name="close" size={22} />
        </button>

        {phase === 'grounding' && (
          <div className="animate-fadeIn card comfort-mode__card">
            {loading ? (
              <div>
                <div className="skeleton" style={{ height: 24, marginBottom: 8, width: '80%', margin: '0 auto 8px' }} />
                <div className="skeleton" style={{ height: 24, width: '60%', margin: '0 auto' }} />
              </div>
            ) : (
              <>
                <p className="studio-text-bright comfort-mode__text">
                  {groundingText}
                </p>
                <div className="comfort-mode__actions">
                  <button
                    className="studio-btn studio-btn--primary tap-feedback"
                    onClick={() => { void speak("Let's do some breathing together."); setPhase('breathing'); }}
                  >
                    Let's breathe together
                  </button>
                  <button
                    className="studio-btn studio-btn--ghost tap-feedback"
                    onClick={() => void skipToNarrative()}
                  >
                    Skip to reassurance
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {phase === 'breathing' && (
          <div className="animate-fadeIn card comfort-mode__card">
            <p className="studio-text-bright" style={{ fontSize: 20, marginBottom: 8 }}>
              Breathe with me, {user?.name?.split(' ')[0]}
            </p>
            <CalmingMusicPlayer url={user?.calmingMusicUrl} />
            <BreathingCircle cycles={3} onComplete={handleBreathingComplete} />
            <button
              className="studio-btn studio-btn--text tap-feedback"
              onClick={() => void skipToNarrative()}
              style={{ marginTop: 12 }}
            >
              Skip breathing
            </button>
          </div>
        )}

        {phase === 'narrative' && (
          <div className="animate-fadeIn card comfort-mode__card">
            <p className="studio-text-bright comfort-mode__text">
              {narrativeText}
            </p>
            <div className="comfort-mode__actions">
              <button className="studio-btn studio-btn--primary tap-feedback" onClick={exitComfort}>
                I'm feeling better
              </button>
              {user?.caregiverName && (
                <a
                  href={`tel:${user?.caregiverPhone ?? '+15555550100'}`}
                  className="studio-btn studio-btn--ghost tap-feedback comfort-mode__call"
                >
                  <StudioIcon name="user" size={18} />
                  <span>{caregiverLabel}</span>
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
