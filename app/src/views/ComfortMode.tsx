import { useState, useEffect, useRef, useCallback } from 'react';
import BreathingCircle from '../components/BreathingCircle';
import StudioIcon from '../components/StudioIcon';
import { useAppStore } from '../store/appStore';
import { generateGrounding, generateNarrative } from '../services/groq';
import { speak, stopSpeaking, unlockAudioPlayback, primeSpeechSynthesis } from '../services/elevenlabs';
import { resumeTibetanBells, startTibetanBells, stopTibetanBells } from '../lib/tibetanBells';
import { NATURE_SCENES, preloadNatureScenes, SCENE_CYCLE_MS } from '../lib/natureScenes';
import { db } from '../db/db';

type Phase = 'grounding' | 'breathing' | 'narrative';

function NatureBackdrop() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    preloadNatureScenes();
    setStarted(true);
    const id = window.setInterval(() => {
      setActiveIndex((i) => (i + 1) % NATURE_SCENES.length);
    }, SCENE_CYCLE_MS);
    return () => clearInterval(id);
  }, []);

  const scene = NATURE_SCENES[activeIndex];

  return (
    <div className={`nature-backdrop${started ? ' nature-backdrop--live' : ''}`} aria-hidden>
      {NATURE_SCENES.map((s, i) => (
        <div
          key={s.id}
          className={`nature-backdrop__scene nature-backdrop__scene--pan-${s.pan}${i === activeIndex ? ' is-active' : ''}`}
          style={{ backgroundImage: `url(${s.url})` }}
        />
      ))}
      <div className="nature-backdrop__gradient" />
      <div className="nature-backdrop__aurora nature-backdrop__aurora--1" />
      <div className="nature-backdrop__aurora nature-backdrop__aurora--2" />
      <div className="nature-backdrop__scene-label">{scene.label}</div>
    </div>
  );
}

export default function ComfortMode() {
  const { user, deactivateComfortMode } = useAppStore();
  const [phase, setPhase] = useState<Phase>('grounding');
  const [groundingText, setGroundingText] = useState('');
  const [narrativeText, setNarrativeText] = useState('');
  const [loading, setLoading] = useState(true);
  const stopBellsRef = useRef<(() => void) | null>(null);
  const cancelledRef = useRef(false);

  const exitComfort = useCallback(() => {
    cancelledRef.current = true;
    stopSpeaking();
    stopTibetanBells();
    stopBellsRef.current?.();
    deactivateComfortMode();
  }, [deactivateComfortMode]);

  const ensureBells = useCallback(() => {
    unlockAudioPlayback();
    void resumeTibetanBells(0.55);
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    primeSpeechSynthesis();
    preloadNatureScenes();
    const stopFn = startTibetanBells(0.55);
    stopBellsRef.current = stopFn;
    return () => {
      cancelledRef.current = true;
      stopFn();
      stopSpeaking();
    };
  }, []);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const init = async () => {
      setLoading(true);
      try {
        const events = await db.events
          .where('userId').equals(userId)
          .and((e) => e.completed)
          .toArray();

        if (cancelled) return;

        const recentEvents = events
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 5)
          .map((e) => e.title);

        const ctx = { recentEvents, upcomingEvents: [] as string[] };

        const [grounding, narrative] = await Promise.all([
          generateGrounding(user!.name, user!.city, ctx),
          generateNarrative(user!.name, recentEvents),
        ]);

        if (cancelled) return;
        setGroundingText(grounding);
        setNarrativeText(narrative);
      } catch {
        if (cancelled) return;
        setGroundingText(
          `You are safe at home in ${user?.city ?? 'your home'}. Everything is okay. Take a slow breath with me.`
        );
        setNarrativeText('Today has been a gentle day. You are resting peacefully at home.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void init();
    return () => { cancelled = true; };
  }, [user?.id, user?.name, user?.city]);

  useEffect(() => {
    if (phase === 'breathing') ensureBells();
  }, [phase, ensureBells]);

  const speakNarrative = useCallback(async () => {
    const text = narrativeText || 'You have done beautifully. You are safe and loved.';
    setPhase('narrative');
    try {
      await speak(text, { clara: true });
    } catch {
      /* browser TTS fallback inside speak() */
    }
  }, [narrativeText]);

  const handleBreathingComplete = useCallback(() => {
    void speakNarrative();
  }, [speakNarrative]);

  const skipToNarrative = useCallback(() => {
    stopSpeaking();
    void speakNarrative();
  }, [speakNarrative]);

  const startBreathing = useCallback(() => {
    stopSpeaking();
    ensureBells();
    void speak(`Let's breathe together, ${user?.name?.split(' ')[0] ?? 'there'}. Follow the circle.`, { clara: true })
      .catch(() => undefined);
    setPhase('breathing');
  }, [ensureBells, user?.name]);

  const hearGrounding = useCallback(() => {
    ensureBells();
    if (!groundingText) return;
    stopSpeaking();
    void speak(groundingText, { clara: true }).catch(() => undefined);
  }, [ensureBells, groundingText]);

  const caregiverLabel = user?.caregiverName ? `Call ${user.caregiverName}` : 'Call caregiver';
  const firstName = user?.name?.split(' ')[0] ?? 'there';

  return (
    <div className="comfort-mode-v2" role="dialog" aria-modal="true" aria-label="Comfort Mode">
      <NatureBackdrop />

      <button
        type="button"
        className="comfort-mode-v2__close tap-feedback"
        onClick={exitComfort}
        aria-label="Exit comfort mode"
      >
        <StudioIcon name="close" size={20} />
      </button>

      <div className="comfort-mode-v2__content">
        <div className="comfort-mode-v2__bell-badge">
          <span className="comfort-mode-v2__bell-pulse" />
          <span className="comfort-mode-v2__bell-label">Tibetan Bells · 40Hz</span>
        </div>

        {phase === 'grounding' && (
          <div className="animate-fadeIn comfort-mode-v2__phase">
            {loading ? (
              <div className="comfort-mode-v2__loading">
                <div className="comfort-mode-v2__loading-dot" />
                <p className="comfort-mode-v2__loading-text">Clara is here…</p>
              </div>
            ) : (
              <>
                <p className="comfort-mode-v2__text">{groundingText}</p>
                <div className="comfort-mode-v2__actions">
                  <button
                    type="button"
                    className="comfort-mode-v2__btn comfort-mode-v2__btn--primary tap-feedback"
                    onClick={startBreathing}
                  >
                    Breathe with me
                  </button>
                  <button
                    type="button"
                    className="comfort-mode-v2__btn comfort-mode-v2__btn--ghost tap-feedback"
                    onClick={hearGrounding}
                  >
                    Hear Clara read this
                  </button>
                  <button
                    type="button"
                    className="comfort-mode-v2__btn comfort-mode-v2__btn--ghost tap-feedback"
                    onClick={skipToNarrative}
                  >
                    Skip to reassurance
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {phase === 'breathing' && (
          <div className="animate-fadeIn comfort-mode-v2__phase">
            <p className="comfort-mode-v2__breathe-heading">Breathe with me, {firstName}</p>
            <BreathingCircle cycles={3} onComplete={handleBreathingComplete} />
            <button
              type="button"
              className="comfort-mode-v2__btn comfort-mode-v2__btn--ghost tap-feedback"
              onClick={skipToNarrative}
              style={{ marginTop: 12 }}
            >
              Skip breathing
            </button>
          </div>
        )}

        {phase === 'narrative' && (
          <div className="animate-fadeIn comfort-mode-v2__phase">
            <p className="comfort-mode-v2__text">{narrativeText}</p>
            <div className="comfort-mode-v2__actions">
              <button type="button" className="comfort-mode-v2__btn comfort-mode-v2__btn--primary tap-feedback" onClick={exitComfort}>
                I'm feeling better
              </button>
              {user?.caregiverName && user?.caregiverPhone && (
                <a
                  href={`tel:${user.caregiverPhone}`}
                  className="comfort-mode-v2__btn comfort-mode-v2__btn--ghost tap-feedback"
                >
                  <StudioIcon name="user" size={16} />
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
