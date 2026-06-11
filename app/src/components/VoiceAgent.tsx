import { useState, useRef, useCallback, useEffect } from 'react';
import { useVoice } from '../hooks/useVoice';
import { useACSE } from '../hooks/useACSE';
import { claraChat } from '../services/groq';
import { useAppStore } from '../store/appStore';
import { detectLoneliness } from '../lib/memoryRecap';
import { CLARA_BACKGROUND, CLARA_PORTRAIT } from '../lib/clara';
import { db, type User } from '../db/db';
import { speak, stopSpeaking, unlockAudioPlayback } from '../services/elevenlabs';
import StudioIcon from './StudioIcon';
import ClaraFlowerPulse from './ClaraFlowerPulse';

type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

const SUGGESTIONS = [
  { label: 'What did I do today?', icon: 'calendar' as const },
  { label: 'Who is my caregiver?', icon: 'user' as const },
  { label: 'I feel lonely', icon: 'heart' as const },
];

const POST_SPEAK_PAUSE_MS = 1_400;

export default function VoiceAgent() {
  const user = useAppStore((s) => s.user);
  const triggerMemoryRecap = useAppStore((s) => s.triggerMemoryRecap);
  const [state, setState] = useState<VoiceState>('idle');
  const [inSession, setInSession] = useState(false);
  const [claraLine, setClaraLine] = useState('');
  const [error, setError] = useState('');
  const { isListening, transcript, startListening, stopListening } = useVoice();
  const { checkRepeatQuestion, recordActivity } = useACSE();
  const historyRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const sessionActiveRef = useRef(false);

  const firstName = user?.name?.split(' ')[0] ?? 'friend';
  const flowerActive = state === 'thinking' || state === 'speaking';

  useEffect(() => {
    unlockAudioPlayback();
    setClaraLine(`Hello, ${firstName}. Tap the microphone when you'd like to chat.`);
    return () => {
      sessionActiveRef.current = false;
      stopSpeaking();
      stopListening();
    };
  }, [stopListening, firstName]);

  const stopSession = useCallback(() => {
    sessionActiveRef.current = false;
    setInSession(false);
    stopSpeaking();
    stopListening();
    setState('idle');
    setClaraLine(`I'm still here, ${firstName}. Tap the mic whenever you're ready.`);
    setError('');
  }, [stopListening, firstName]);

  const processUtterance = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      if (sessionActiveRef.current) {
        setClaraLine("I didn't catch that — take your time and try again.");
      }
      return;
    }

    checkRepeatQuestion(trimmed);

    if (detectLoneliness(trimmed)) {
      stopSpeaking();
      stopListening();
      sessionActiveRef.current = false;
      setInSession(false);
      setState('idle');
      triggerMemoryRecap('loneliness');
      return;
    }

    setError('');
    setState('thinking');
    setClaraLine('');

    let response = "I'm here with you. Could you say that once more?";

    try {
      const ctx = await buildContext(user);
      response = await claraChat(trimmed, historyRef.current, user?.name ?? 'Margaret', ctx);
      historyRef.current = [
        ...historyRef.current,
        { role: 'user' as const, content: trimmed },
        { role: 'assistant' as const, content: response },
      ].slice(-20);
    } catch (err) {
      console.error(err);
      setError('Connection issue — tap the mic to try again');
      sessionActiveRef.current = false;
      setInSession(false);
      setState('idle');
      return;
    }

    if (!sessionActiveRef.current) return;

    stopListening();
    setClaraLine(response);
    setState('speaking');

    try {
      await speak(response, { clara: true });
    } catch (err) {
      console.error(err);
      // Voice failed — show a soft notice but keep the session alive so the
      // user can continue the conversation via text/mic without re-tapping.
      setError('Voice unavailable — read my reply above, then tap the mic to continue.');
      await new Promise((r) => setTimeout(r, 2800));
      if (!sessionActiveRef.current) return;
      setError('');
    }

    if (sessionActiveRef.current) {
      await new Promise((r) => setTimeout(r, POST_SPEAK_PAUSE_MS));
    }

    if (!sessionActiveRef.current) {
      setState('idle');
    }
  }, [checkRepeatQuestion, recordActivity, triggerMemoryRecap, user, stopListening]);

  const runListeningTurn = useCallback(async () => {
    while (sessionActiveRef.current) {
      try {
        stopSpeaking();
        await new Promise((r) => setTimeout(r, 300));
        setState('listening');
        setClaraLine("I'm listening… speak naturally, then pause when you're done.");
        setError('');
        const heard = await startListening();
        if (!sessionActiveRef.current) break;
        await processUtterance(heard);
      } catch (err) {
        console.error(err);
        if (!sessionActiveRef.current) break;
        const msg = err instanceof Error ? err.message : 'Could not hear you';
        if (msg.includes('denied') || msg.includes('not-allowed')) {
          setError('Please allow microphone access in your browser settings.');
          setClaraLine('Once the mic is allowed, tap below and we can talk.');
          sessionActiveRef.current = false;
          setInSession(false);
          setState('idle');
          break;
        }
        setClaraLine("I didn't quite catch that — go ahead when you're ready.");
        await new Promise((r) => setTimeout(r, 800));
      }
    }
  }, [startListening, processUtterance]);

  const handleMicTap = useCallback(() => {
    unlockAudioPlayback();

    if (state === 'speaking' || state === 'listening' || state === 'thinking' || inSession) {
      stopSession();
      return;
    }

    stopSpeaking();
    sessionActiveRef.current = true;
    setInSession(true);
    setError('');
    void runListeningTurn();
  }, [state, inSession, stopSession, runListeningTurn]);

  const handleChip = (q: string) => {
    unlockAudioPlayback();
    stopSpeaking();
    stopListening();
    sessionActiveRef.current = true;
    setInSession(true);
    setError('');
    void processUtterance(q).then(() => {
      if (sessionActiveRef.current) void runListeningTurn();
    });
  };

  const statusLabel =
    state === 'listening' ? 'Listening' :
    state === 'thinking' ? 'Thinking' :
    state === 'speaking' ? 'Speaking' : inSession ? 'In conversation' : 'Ready';

  const showLiveTranscript = state === 'listening' && transcript.length > 0;

  return (
    <div className="clara-room clara-room--seamless">
      <div
        className="clara-room__backdrop"
        aria-hidden
        style={{ backgroundImage: `url(${CLARA_BACKGROUND})` }}
      />

      <div className="clara-room__inner studio-scroll">
        <header className="clara-room__header clara-room__header--slim">
          <img src={CLARA_PORTRAIT} alt="" className="clara-room__avatar-sm" />
          <div className="clara-room__intro">
            <h1 className="clara-room__name">Clara</h1>
            <span className={`clara-room__badge clara-room__badge--${state}`}>{statusLabel}</span>
          </div>
        </header>

        <div className="clara-room__stage">
          <ClaraFlowerPulse active={flowerActive} size={96} className="clara-room__flower" />
          {!flowerActive && state === 'listening' && (
            <div className="clara-room__wave clara-room__wave--inline" aria-hidden>
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className="clara-room__wave-bar" style={{ animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
          )}
        </div>

        <div className={`clara-room__speech clara-room__speech--seamless clara-room__speech--${state}`} aria-live="polite">
          {error ? (
            <p className="clara-room__error">{error}</p>
          ) : (
            <>
              {claraLine ? <p className="clara-room__line">{claraLine}</p> : null}
              {showLiveTranscript && (
                <p className="clara-room__heard">
                  <span className="clara-room__heard-label">Hearing:</span> {transcript}
                </p>
              )}
            </>
          )}
        </div>

        <div className="clara-room__controls">
          <button
            type="button"
            className={`clara-room__mic tap-feedback clara-room__mic--${state}`}
            onClick={handleMicTap}
            aria-label={
              inSession ? 'End conversation' :
              state === 'speaking' ? 'Stop Clara' : 'Talk to Clara'
            }
          >
            <span className="clara-room__mic-ring" />
            <span className="clara-room__mic-ring clara-room__mic-ring--2" />
            <StudioIcon name={isListening ? 'mic' : 'clara'} size={32} />
          </button>
          <p className="clara-room__mic-hint">
            {inSession
              ? 'Tap to end'
              : state === 'speaking'
                ? 'Tap to interrupt'
                : 'Tap to talk — pause when finished'}
          </p>
        </div>

        {!inSession && state === 'idle' && (
          <section className="clara-room__suggestions">
            <p className="clara-room__suggestions-label">Quick things to say</p>
            <div className="clara-room__chips">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  className="clara-room__chip tap-feedback"
                  onClick={() => handleChip(s.label)}
                >
                  <StudioIcon name={s.icon} size={18} />
                  {s.label}
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

async function buildContext(user: User | null) {
  const userId = user?.id ?? 1;
  const now = new Date();
  const events = await db.events.where('userId').equals(userId).toArray();
  const completed = events
    .filter((e) => e.completed && new Date(e.timestamp) <= now)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5);
  const upcoming = events
    .filter((e) => !e.completed && new Date(e.timestamp) > now)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(0, 3);
  return {
    recentEvents: completed.map(
      (e) => `${e.title} at ${new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    ),
    upcomingEvents: upcoming.map(
      (e) => `${e.title} at ${new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    ),
    caregiverName: user?.caregiverName,
    city: user?.city,
  };
}
