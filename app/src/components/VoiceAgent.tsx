import { useState, useRef, useCallback, useEffect } from 'react';
import { useVoice } from '../hooks/useVoice';
import { useACSE } from '../hooks/useACSE';
import { claraChat } from '../services/groq';
import { useAppStore } from '../store/appStore';
import { db } from '../db/db';
import { speak, stopSpeaking, unlockAudioPlayback } from '../services/elevenlabs';

type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

export default function VoiceAgent() {
  const user = useAppStore((s) => s.user);
  const [state, setState] = useState<VoiceState>('idle');
  const [inSession, setInSession] = useState(false);
  const [subtitle, setSubtitle] = useState('');
  const [error, setError] = useState('');
  const { startListening, stopListening } = useVoice();
  const { checkRepeatQuestion, recordActivity } = useACSE();
  const historyRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const sessionActiveRef = useRef(false);

  useEffect(() => {
    unlockAudioPlayback();
    setSubtitle('Tap the circle to talk with Clara');
    return () => {
      sessionActiveRef.current = false;
      stopSpeaking();
      stopListening();
    };
  }, [stopListening]);

  const stopSession = useCallback(() => {
    sessionActiveRef.current = false;
    setInSession(false);
    stopSpeaking();
    stopListening();
    setState('idle');
    setSubtitle('Tap the circle to talk with Clara');
    setError('');
  }, [stopListening]);

  const processUtterance = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      if (sessionActiveRef.current) {
        setSubtitle("I didn't catch that — go ahead when you're ready");
      } else {
        setState('idle');
        setSubtitle('Tap the circle to talk with Clara');
      }
      return;
    }

    checkRepeatQuestion(trimmed);
    recordActivity();
    setError('');
    setState('thinking');
    setSubtitle('Clara is thinking…');

    let response = "I'm here with you. Could you say that again?";

    try {
      const ctx = await buildContext(user?.id ?? 1);
      response = await claraChat(trimmed, historyRef.current, user?.name ?? 'Margaret', ctx);
      historyRef.current = [
        ...historyRef.current,
        { role: 'user' as const, content: trimmed },
        { role: 'assistant' as const, content: response },
      ].slice(-20);
    } catch (err) {
      console.error(err);
      setError('Connection issue — tap to try again');
      sessionActiveRef.current = false;
      setInSession(false);
    }

    if (!sessionActiveRef.current) return;

    setSubtitle(response);
    setState('speaking');

    try {
      await speak(response);
    } catch (err) {
      console.error(err);
      setError('Voice unavailable — check your connection');
      sessionActiveRef.current = false;
      setInSession(false);
    }

    if (!sessionActiveRef.current) {
      setState('idle');
      setSubtitle('Tap the circle to talk with Clara');
    }
  }, [checkRepeatQuestion, recordActivity, user]);

  const runListeningTurn = useCallback(async () => {
    while (sessionActiveRef.current) {
      try {
        setState('listening');
        setSubtitle('Listening… speak now');
        setError('');
        const transcript = await startListening();
        if (!sessionActiveRef.current) break;
        await processUtterance(transcript);
      } catch (err) {
        console.error(err);
        if (!sessionActiveRef.current) break;
        const msg = err instanceof Error ? err.message : 'Could not hear you';
        setError(msg.includes('denied') ? 'Allow microphone access to talk to Clara' : msg);
        setSubtitle('Tap to try again');
        sessionActiveRef.current = false;
        setInSession(false);
        setState('idle');
        break;
      }
    }
  }, [startListening, processUtterance]);

  const handleOrbTap = useCallback(() => {
    unlockAudioPlayback();

    if (state === 'speaking' || state === 'listening' || state === 'thinking' || inSession) {
      stopSession();
      return;
    }

    sessionActiveRef.current = true;
    setInSession(true);
    setError('');
    void runListeningTurn();
  }, [state, inSession, stopSession, runListeningTurn]);

  const stateLabel =
    state === 'listening' ? 'Listening' :
    state === 'thinking'  ? 'Thinking' :
    state === 'speaking'  ? 'Speaking' : inSession ? 'Ready' : 'Ready';

  return (
    <div className="clara-voice">
      <div className="clara-voice__header">
        <p className="clara-voice__name">Clara</p>
        <p className="clara-voice__mode">Voice companion</p>
      </div>

      <div className="clara-voice__stage">
        <button
          type="button"
          className={`clara-voice__orb tap-feedback clara-voice__orb--${state}`}
          onClick={handleOrbTap}
          aria-label={
            inSession ? 'End conversation with Clara' :
            state === 'speaking' ? 'Stop Clara' :
            state === 'listening' ? 'Stop listening' : 'Talk to Clara'
          }
        >
          <span className="clara-voice__ring clara-voice__ring--1" />
          <span className="clara-voice__ring clara-voice__ring--2" />
          <span className="clara-voice__ring clara-voice__ring--3" />
          <span className="clara-voice__core">
            {state === 'thinking' && <span className="clara-voice__dots"><i /><i /><i /></span>}
            {state === 'listening' && (
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0014 0M12 19v3"/>
              </svg>
            )}
            {state === 'speaking' && (
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/>
              </svg>
            )}
            {state === 'idle' && (
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0014 0M12 19v3M8 22h8"/>
              </svg>
            )}
          </span>
        </button>
        <p className={`clara-voice__state clara-voice__state--${state}`}>{stateLabel}</p>
      </div>

      <div className="clara-voice__caption" aria-live="polite">
        {error ? <p className="clara-voice__error">{error}</p> : <p>{subtitle}</p>}
      </div>

      <p className="clara-voice__hint">
        {inSession
          ? 'Tap to end conversation'
          : state === 'speaking'
            ? 'Tap to interrupt'
            : 'Tap once — Clara keeps listening'}
      </p>

      {!inSession && state === 'idle' && (
        <div className="clara-chips">
          <p className="clara-chips__label">Try asking:</p>
          {['What did I do today?', 'Who is my caregiver?', 'What medication is due?'].map((q) => (
            <button
              key={q}
              type="button"
              className="clara-chip tap-feedback"
              onClick={() => {
                sessionActiveRef.current = true;
                setInSession(true);
                void processUtterance(q);
              }}
            >
              {q}
            </button>
          ))}
          <p className="clara-chips__note">Ask the same question twice to trigger Comfort Mode</p>
        </div>
      )}
    </div>
  );
}

async function buildContext(userId: number) {
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
  };
}
