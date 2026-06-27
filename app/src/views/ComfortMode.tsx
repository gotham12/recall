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
    </div>
  );
}

// Phase progress dots
function PhaseDots({ phase }: { phase: Phase }) {
  const phases: Phase[] = ['grounding', 'breathing', 'narrative'];
  return (
    <div className="cm-phase-dots" aria-label="Progress">
      {phases.map((p) => (
        <div
          key={p}
          className={`cm-phase-dot${phase === p ? ' cm-phase-dot--active' : phases.indexOf(phase) > phases.indexOf(p) ? ' cm-phase-dot--done' : ''}`}
        />
      ))}
    </div>
  );
}

export default function ComfortMode() {
  const { user, deactivateComfortMode } = useAppStore();
  const [phase, setPhase] = useState<Phase>('grounding');
  const [groundingText, setGroundingText] = useState('');
  const [narrativeText, setNarrativeText] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const stopBellsRef = useRef<(() => void) | null>(null);
  const cancelledRef = useRef(false);

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const dayStr = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const caregiverLabel = user?.caregiverName ? `Call ${user.caregiverName}` : 'Call caregiver';
  const hasCaregiver = !!(user?.caregiverName && user?.caregiverPhone);

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
    if (!userId) { setLoading(false); return; }

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
          `You are safe at home in ${user?.city ?? 'your home'}. Everything is okay. Take a slow breath — you are surrounded by people who love you.`
        );
        setNarrativeText(
          `Today has been a gentle day, ${firstName}. You have taken good care of yourself and you are safe.`
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void init();
    return () => { cancelled = true; };
  }, [user?.id, user?.name, user?.city, firstName]);

  useEffect(() => {
    if (phase === 'breathing') ensureBells();
  }, [phase, ensureBells]);

  const speakText = useCallback(async (text: string) => {
    setIsSpeaking(true);
    ensureBells();
    try {
      await speak(text, { clara: true });
    } catch { /* browser TTS fallback inside speak() */ }
    finally { setIsSpeaking(false); }
  }, [ensureBells]);

  const speakNarrative = useCallback(async () => {
    const text = narrativeText || `You have done beautifully, ${firstName}. You are safe and loved.`;
    setPhase('narrative');
    await speakText(text);
  }, [narrativeText, firstName, speakText]);

  const handleBreathingComplete = useCallback(() => {
    void speakNarrative();
  }, [speakNarrative]);

  const startBreathing = useCallback(() => {
    stopSpeaking();
    setIsSpeaking(false);
    ensureBells();
    void speak(`Let's breathe together, ${firstName}. Follow the circle.`, { clara: true })
      .catch(() => undefined);
    setPhase('breathing');
  }, [ensureBells, firstName]);

  const hearGrounding = useCallback(() => {
    if (!groundingText) return;
    stopSpeaking();
    void speakText(groundingText);
  }, [groundingText, speakText]);

  const skipToNarrative = useCallback(() => {
    stopSpeaking();
    setIsSpeaking(false);
    void speakNarrative();
  }, [speakNarrative]);

  return (
    <div className="comfort-mode-v2" role="dialog" aria-modal="true" aria-label="Comfort Mode">
      <NatureBackdrop />

      {/* Close */}
      <button
        type="button"
        className="comfort-mode-v2__close tap-feedback"
        onClick={exitComfort}
        aria-label="Exit comfort mode"
      >
        <StudioIcon name="close" size={20} />
      </button>

      {/* Always-visible top anchor bar */}
      <div className="cm-anchor-bar">
        <div className="cm-anchor-bar__safe">You are safe, {firstName}</div>
        <div className="cm-anchor-bar__datetime">{dayStr} · {timeStr}</div>
      </div>

      <div className="comfort-mode-v2__content">

        {/* Phase progress dots */}
        <PhaseDots phase={phase} />

        {/* Bell badge */}
        <div className="comfort-mode-v2__bell-badge">
          <span className="comfort-mode-v2__bell-pulse" />
          <span className="comfort-mode-v2__bell-label">Tibetan Bells · 40Hz</span>
        </div>

        {/* ── Phase: Grounding ── */}
        {phase === 'grounding' && (
          <div className="animate-fadeIn comfort-mode-v2__phase">
            {loading ? (
              <div className="comfort-mode-v2__loading">
                <div className="comfort-mode-v2__loading-dot" />
                <p className="comfort-mode-v2__loading-text">Clara is here with you…</p>
              </div>
            ) : (
              <>
                <p className="comfort-mode-v2__text cm-grounding-pulse">{groundingText}</p>
                <div className="comfort-mode-v2__actions">
                  <button
                    type="button"
                    className="comfort-mode-v2__btn comfort-mode-v2__btn--primary tap-feedback"
                    onClick={startBreathing}
                  >
                    🌬 Breathe with me
                  </button>
                  <button
                    type="button"
                    className="comfort-mode-v2__btn comfort-mode-v2__btn--ghost tap-feedback"
                    onClick={isSpeaking ? () => { stopSpeaking(); setIsSpeaking(false); } : hearGrounding}
                    disabled={!groundingText}
                  >
                    {isSpeaking ? '⏸ Pause Clara' : '🔊 Hear Clara read this'}
                  </button>
                  <button
                    type="button"
                    className="comfort-mode-v2__btn comfort-mode-v2__btn--ghost tap-feedback"
                    onClick={skipToNarrative}
                  >
                    Skip to reassurance
                  </button>
                  {hasCaregiver && (
                    <a
                      href={`tel:${user!.caregiverPhone}`}
                      className="comfort-mode-v2__btn comfort-mode-v2__btn--call tap-feedback"
                    >
                      <StudioIcon name="user" size={18} />
                      <span>{caregiverLabel}</span>
                    </a>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Phase: Breathing ── */}
        {phase === 'breathing' && (
          <div className="animate-fadeIn comfort-mode-v2__phase">
            <p className="comfort-mode-v2__breathe-heading">Breathe with me, {firstName}</p>
            <p className="cm-breathe-sub">Breathe in · Hold · Breathe out · Rest</p>
            <BreathingCircle cycles={3} onComplete={handleBreathingComplete} />
            <div className="comfort-mode-v2__actions" style={{ marginTop: 16 }}>
              <button
                type="button"
                className="comfort-mode-v2__btn comfort-mode-v2__btn--ghost tap-feedback"
                onClick={skipToNarrative}
              >
                Skip breathing
              </button>
              {hasCaregiver && (
                <a
                  href={`tel:${user!.caregiverPhone}`}
                  className="comfort-mode-v2__btn comfort-mode-v2__btn--call tap-feedback"
                >
                  <StudioIcon name="user" size={18} />
                  <span>{caregiverLabel}</span>
                </a>
              )}
            </div>
          </div>
        )}

        {/* ── Phase: Narrative ── */}
        {phase === 'narrative' && (
          <div className="animate-fadeIn comfort-mode-v2__phase">
            <p className="comfort-mode-v2__text">{narrativeText}</p>
            <div className="comfort-mode-v2__actions">
              <button
                type="button"
                className="comfort-mode-v2__btn comfort-mode-v2__btn--primary tap-feedback"
                onClick={exitComfort}
              >
                ✓ I'm feeling better
              </button>
              <button
                type="button"
                className="comfort-mode-v2__btn comfort-mode-v2__btn--ghost tap-feedback"
                onClick={isSpeaking ? () => { stopSpeaking(); setIsSpeaking(false); } : () => void speakText(narrativeText)}
              >
                {isSpeaking ? '⏸ Pause Clara' : '🔊 Hear Clara read this'}
              </button>
              {hasCaregiver && (
                <a
                  href={`tel:${user!.caregiverPhone}`}
                  className="comfort-mode-v2__btn comfort-mode-v2__btn--call tap-feedback"
                >
                  <StudioIcon name="user" size={18} />
                  <span>{caregiverLabel}</span>
                </a>
              )}
              <button
                type="button"
                className="comfort-mode-v2__btn comfort-mode-v2__btn--ghost tap-feedback"
                style={{ opacity: 0.7 }}
                onClick={() => { stopSpeaking(); setPhase('grounding'); }}
              >
                ← Back to beginning
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
