import { useState, useRef, useCallback, useEffect } from 'react';
import { useClaraVoice } from '../hooks/useClaraVoice';
import { useACSE } from '../hooks/useACSE';
import { claraChat } from '../services/groq';
import { useAppStore } from '../store/appStore';
import { buildClaraRichContext } from '../lib/claraContext';
import {
  detectClaraIntent,
  getTailoredResponse,
  type MemoryRecapReason,
} from '../lib/claraIntents';
import { speak, stopSpeaking, unlockAudioPlayback } from '../services/elevenlabs';
import StudioIcon from './StudioIcon';
import ClaraFlowerPulse from './ClaraFlowerPulse';

type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

const SUGGESTIONS = [
  { label: 'What did I do today?', icon: 'calendar' as const },
  { label: 'Who is my caregiver?', icon: 'user' as const },
  { label: 'I feel lonely', icon: 'heart' as const },
];

const POST_SPEAK_PAUSE_MS = 1_200;
const CASCADE_DELAY_MS = 1_800;

export default function VoiceAgent() {
  const user = useAppStore((s) => s.user);
  const acseScore = useAppStore((s) => s.acseScore);
  const triggerMemoryRecap = useAppStore((s) => s.triggerMemoryRecap);
  const activateComfortMode = useAppStore((s) => s.activateComfortMode);
  const [state, setState] = useState<VoiceState>('idle');
  const [inSession, setInSession] = useState(false);
  const [claraLine, setClaraLine] = useState('');
  const [error, setError] = useState('');
  const [llmConnected, setLlmConnected] = useState<boolean | null>(null);
  const { isListening, startListening, stopListening } = useClaraVoice();
  const { checkRepeatQuestion } = useACSE();
  const historyRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const sessionActiveRef = useRef(false);
  const greetingSetRef = useRef(false);

  const firstName = user?.name?.split(' ')[0] ?? 'friend';
  const flowerActive = state === 'thinking' || state === 'speaking';

  useEffect(() => {
    unlockAudioPlayback();
    if (!greetingSetRef.current) {
      setClaraLine(`Hello, ${firstName}. I'm Clara — tap the microphone and we can talk.`);
      greetingSetRef.current = true;
    }
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

  const speakResponse = useCallback(async (response: string, force = false) => {
    if (!force && !sessionActiveRef.current) return;
    stopListening();
    setClaraLine(response);
    setState('speaking');
    try {
      unlockAudioPlayback();
      await speak(response, { clara: true });
    } catch (err) {
      console.error(err);
    }
    await new Promise((r) => setTimeout(r, POST_SPEAK_PAUSE_MS));
    setState('idle');
  }, [stopListening]);

  const runCascade = useCallback(
    async (cascade: 'memory_recap' | 'comfort_mode', recapReason?: MemoryRecapReason) => {
      if (!sessionActiveRef.current) return;
      await new Promise((r) => setTimeout(r, CASCADE_DELAY_MS));
      sessionActiveRef.current = false;
      setInSession(false);
      setState('idle');

      if (cascade === 'memory_recap') {
        triggerMemoryRecap(recapReason ?? 'disorientation');
      } else if (cascade === 'comfort_mode') {
        activateComfortMode();
      }
    },
    [triggerMemoryRecap, activateComfortMode]
  );

  const processUtterance = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      if (sessionActiveRef.current) {
        setClaraLine("I didn't catch that — take your time and try again.");
      }
      return;
    }

    checkRepeatQuestion(trimmed);
    setError('');
    setState('thinking');
    setClaraLine('One moment…');

    const intent = detectClaraIntent(trimmed);
    const ctx = await buildClaraRichContext(user, acseScore);

    let response: string;

    if (intent.tailoredFirst) {
      response = getTailoredResponse(intent.intent, ctx);
    } else {
      try {
        const result = await claraChat(trimmed, historyRef.current, user?.name ?? 'Margaret', ctx);
        response = result.reply;
        setLlmConnected(result.fromLlm);
      } catch (err) {
        console.error(err);
        response = getTailoredResponse(intent.intent, ctx);
        setLlmConnected(false);
      }
    }

    historyRef.current = [
      ...historyRef.current,
      { role: 'user' as const, content: trimmed },
      { role: 'assistant' as const, content: response },
    ].slice(-20);

    if (!sessionActiveRef.current) return;

    await speakResponse(response);

    if (intent.cascade === 'memory_recap') {
      await runCascade('memory_recap', intent.recapReason);
    } else if (intent.cascade === 'comfort_mode') {
      await runCascade('comfort_mode');
    }
  }, [checkRepeatQuestion, user, acseScore, speakResponse, runCascade]);

  const runListeningTurn = useCallback(async () => {
    while (sessionActiveRef.current) {
      try {
        stopSpeaking();
        await new Promise((r) => setTimeout(r, 300));
        setState('listening');
        setClaraLine("I'm listening…");
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
  }, [startListening, processUtterance, stopSpeaking]);

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
  }, [state, inSession, stopSession, runListeningTurn, stopSpeaking]);

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

  const [typedInput, setTypedInput] = useState('');

  const handleTextSend = () => {
    const text = typedInput.trim();
    if (!text) return;
    setTypedInput('');
    unlockAudioPlayback();
    stopSpeaking();
    stopListening();
    sessionActiveRef.current = true;
    setInSession(true);
    setError('');
    void (async () => {
      checkRepeatQuestion(text);
      setState('thinking');
      setClaraLine('One moment…');
      const intent = detectClaraIntent(text);
      const ctx = await buildClaraRichContext(user, acseScore);
      let response: string;
      if (intent.tailoredFirst) {
        response = getTailoredResponse(intent.intent, ctx);
      } else {
        try {
          const result = await claraChat(text, historyRef.current, user?.name ?? 'Margaret', ctx);
          response = result.reply;
          setLlmConnected(result.fromLlm);
        } catch {
          response = getTailoredResponse(intent.intent, ctx);
          setLlmConnected(false);
        }
      }
      historyRef.current = [
        ...historyRef.current,
        { role: 'user' as const, content: text },
        { role: 'assistant' as const, content: response },
      ].slice(-20);
      await speakResponse(response, true);
      sessionActiveRef.current = false;
      setInSession(false);
    })();
  };

  const statusLabel =
    state === 'listening' ? 'Listening' :
    state === 'thinking' ? 'Thinking' :
    state === 'speaking' ? 'Speaking' : inSession ? 'In conversation' : 'Ready';

  return (
    <div className="clara-room clara-room--seamless">
      <div className="clara-room__inner studio-scroll">
        <header className="clara-room__header clara-room__header--slim">
          <div className="clara-room__avatar-sm clara-room__avatar-icon">
            <StudioIcon name="clara" size={22} />
          </div>
          <div className="clara-room__intro">
            <h1 className="clara-room__name">Clara</h1>
            <span className={`clara-room__badge clara-room__badge--${state}`}>{statusLabel}</span>
            {llmConnected === false && (
              <span className="clara-room__offline-badge">Offline mode</span>
            )}
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

        <div
          className={`clara-room__speech clara-room__speech--seamless clara-room__speech--${state}`}
          aria-live="polite"
        >
          {error ? (
            <>
              <p className="clara-room__error">{error}</p>
              {claraLine && <p className="clara-room__line">{claraLine}</p>}
            </>
          ) : (
            claraLine ? <p className="clara-room__line">{claraLine}</p> : null
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
                : 'Tap to talk'}
          </p>
        </div>

        <div className="clara-room__text-input clara-room__text-input--desktop">
          <input
            type="text"
            className="clara-room__text-field"
            placeholder="Type a message to Clara…"
            value={typedInput}
            onChange={(e) => setTypedInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleTextSend(); }}
            aria-label="Type a message to Clara"
          />
          <button
            type="button"
            className="clara-room__text-send tap-feedback"
            onClick={handleTextSend}
            aria-label="Send"
            disabled={!typedInput.trim()}
          >
            <StudioIcon name="send" size={18} />
          </button>
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
