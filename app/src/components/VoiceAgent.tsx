import { useState, useRef, useCallback, useEffect } from 'react';
import { useClaraVoice } from '../hooks/useClaraVoice';
import { useACSE } from '../hooks/useACSE';
import { claraChat } from '../services/groq';
import { useAppStore } from '../store/appStore';
import { buildClaraRichContext, type ClaraRichContext } from '../lib/claraContext';
import {
  detectClaraIntent,
  getTailoredResponse,
  type MemoryRecapReason,
} from '../lib/claraIntents';
import { logClaraVoiceExchange } from '../lib/claraActivityLog';
import {
  speak,
  stopSpeaking,
  unlockAudioPlayback,
  primeSpeechSynthesis,
} from '../services/elevenlabs';
import { addRoutineEvent, parseRoutineUtterance } from '../lib/routineUtils';
import StudioIcon, { type IconName } from './StudioIcon';

type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

const POST_SPEAK_PAUSE_MS = 120;
const CASCADE_DELAY_MS = 400;
const CLARA_CONTEXT_TTL_MS = 15_000;

async function speakAloud(text: string): Promise<void> {
  unlockAudioPlayback();
  await speak(text, { clara: true });
}

export default function VoiceAgent() {
  const user = useAppStore((s) => s.user);
  const acseScore = useAppStore((s) => s.acseScore);
  const triggerMemoryRecap = useAppStore((s) => s.triggerMemoryRecap);
  const activateComfortMode = useAppStore((s) => s.activateComfortMode);
  const comfortModeActive = useAppStore((s) => s.comfortModeActive);

  const [state, setState] = useState<VoiceState>('idle');
  const [inSession, setInSession] = useState(false);
  const [claraLine, setClaraLine] = useState('');
  const [error, setError] = useState('');
  const [llmConnected, setLlmConnected] = useState<boolean | null>(null);
  const [typedInput, setTypedInput] = useState('');

  const { startListening, stopListening } = useClaraVoice();
  const { checkRepeatQuestion } = useACSE();

  const historyRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const sessionActiveRef = useRef(false);
  const greetingSetRef = useRef(false);
  const ctxRef = useRef<ClaraRichContext | null>(null);
  const ctxLoadedAtRef = useRef(0);

  const firstName = user?.name?.split(' ')[0] ?? 'friend';
  const flowerActive = state === 'thinking' || state === 'speaking';

  const loadClaraContext = useCallback(async (): Promise<ClaraRichContext> => {
    const now = Date.now();
    if (ctxRef.current && now - ctxLoadedAtRef.current < CLARA_CONTEXT_TTL_MS) {
      return ctxRef.current;
    }
    const ctx = await buildClaraRichContext(user, acseScore, comfortModeActive);
    ctxRef.current = ctx;
    ctxLoadedAtRef.current = now;
    return ctx;
  }, [user, acseScore, comfortModeActive]);

  useEffect(() => {
    ctxRef.current = null;
    ctxLoadedAtRef.current = 0;
  }, [user?.id, acseScore, comfortModeActive]);

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

  useEffect(() => {
    if (!user?.id || !comfortModeActive) return;
    sessionActiveRef.current = false;
    setInSession(false);
    stopSpeaking();
    stopListening();
    setState('idle');
  }, [comfortModeActive, user?.id, stopListening]);

  const stopSession = useCallback(() => {
    sessionActiveRef.current = false;
    setInSession(false);
    stopSpeaking();
    stopListening();
    setState('idle');
    setClaraLine(`I'm still here, ${firstName}. Tap the mic whenever you're ready.`);
    setError('');
  }, [stopListening, firstName]);

  const speakResponse = useCallback(async (response: string) => {
    if (!sessionActiveRef.current) return;
    stopListening();
    setClaraLine(response);
    setState('speaking');

    try {
      unlockAudioPlayback();
      await speakAloud(response);
    } catch (err) {
      console.error('[Clara TTS] all methods failed:', err);
    } finally {
      await new Promise<void>((r) => setTimeout(r, POST_SPEAK_PAUSE_MS));
      // Always leave speaking state — loop will set listening next
      if (sessionActiveRef.current) {
        setState('listening');
        setClaraLine("I'm listening…");
      } else {
        setState('idle');
      }
    }
  }, [stopListening]);

  const runCascade = useCallback(
    async (cascade: 'memory_recap' | 'comfort_mode', recapReason?: MemoryRecapReason) => {
    if (!sessionActiveRef.current) return;
    void (async () => {
      await new Promise<void>((r) => setTimeout(r, CASCADE_DELAY_MS));
      if (!sessionActiveRef.current) return;
      sessionActiveRef.current = false;
      setInSession(false);
      setState('idle');
      if (cascade === 'memory_recap') triggerMemoryRecap(recapReason ?? 'disorientation');
      else if (cascade === 'comfort_mode' && !useAppStore.getState().comfortModeActive) activateComfortMode();
    })();
    },
    [triggerMemoryRecap, activateComfortMode]
  );

  const processUtterance = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      if (sessionActiveRef.current) setClaraLine("I didn't catch that — go ahead.");
      return;
    }

    checkRepeatQuestion(trimmed);
    setError('');
    setState('thinking');
    setClaraLine('One moment…');

    const intent = detectClaraIntent(trimmed);
    const ctx = await loadClaraContext();
    let response: string;

    if (intent.intent === 'add_routine') {
      const parsed = parseRoutineUtterance(trimmed);
      if (parsed) {
        addRoutineEvent(parsed.name, parsed.time);
        const timeClause = parsed.time ? ` at ${parsed.time}` : '';
        response = `I've added "${parsed.name}"${timeClause} to your routine, ${firstName}.`;
      } else {
        response = `Tell me what to add and what time, ${firstName}.`;
      }
    } else if (intent.intent === 'query_routine') {
      response = getTailoredResponse('query_routine', ctx);
    } else if (intent.intent === 'time_date') {
      response = getTailoredResponse('time_date', ctx);
    } else if (intent.tailoredFirst) {
      response = getTailoredResponse(intent.intent, ctx);
    } else {
      try {
        const result = await claraChat(trimmed, historyRef.current, user?.name ?? 'Margaret', ctx);
        response = result.reply;
        setLlmConnected(result.fromLlm);
      } catch (err) {
        console.error('[Clara LLM]', err);
        response = getTailoredResponse(intent.intent, ctx);
        setLlmConnected(false);
      }
    }

    historyRef.current = [
      ...historyRef.current,
      { role: 'user' as const, content: trimmed },
      { role: 'assistant' as const, content: response },
    ].slice(-20);

    if (user?.id) {
      void logClaraVoiceExchange(user.id, trimmed, response, intent.intent);
    }

    if (!sessionActiveRef.current) return;
    await speakResponse(response);

    if (!sessionActiveRef.current) return;
    if (intent.cascade === 'memory_recap') void runCascade('memory_recap', intent.recapReason);
    else if (intent.cascade === 'comfort_mode') void runCascade('comfort_mode');
  }, [checkRepeatQuestion, user, loadClaraContext, speakResponse, runCascade, firstName]);

  const runConversation = useCallback(async () => {
    while (sessionActiveRef.current) {
      try {
        if (!sessionActiveRef.current) break;

        setState('listening');
        setClaraLine("I'm listening…");
        setError('');

        const heard = await startListening();
        if (!sessionActiveRef.current) break;

        if (!heard.trim()) {
          setClaraLine("I'm still listening — go ahead.");
          continue;
        }

        await processUtterance(heard);
        // speakResponse sets state back to listening in its finally block
      } catch (err) {
        console.error('[Clara voice]', err);
        if (!sessionActiveRef.current) break;
        const msg = (err instanceof Error ? err.message : '').toLowerCase();
        if (msg.includes('denied') || msg.includes('not-allowed') || msg.includes('permission')) {
          setError('Please allow microphone access in your browser settings.');
          setClaraLine('Once the mic is allowed, tap below and we can talk.');
          sessionActiveRef.current = false;
          setInSession(false);
          setState('idle');
          return;
        }
        setClaraLine("Let's try again — I'm listening.");
        setState('listening');
        await new Promise<void>((r) => setTimeout(r, 600));
      }
    }
    sessionActiveRef.current = false;
    setInSession(false);
    setState('idle');
  }, [startListening, processUtterance]);

  const handleMicTap = useCallback(() => {
    unlockAudioPlayback();
    primeSpeechSynthesis();

    if (inSession) {
      stopSession();
      return;
    }

    stopSpeaking();
    void loadClaraContext();
    sessionActiveRef.current = true;
    setInSession(true);
    setError('');
    void runConversation();
  }, [inSession, stopSession, runConversation, loadClaraContext]);

  const handleTextSend = () => {
    const text = typedInput.trim();
    if (!text || inSession) return;
    setTypedInput('');
    unlockAudioPlayback();
    primeSpeechSynthesis();
    stopSpeaking();
    stopListening();
    sessionActiveRef.current = true;
    setInSession(true);
    setError('');
    void processUtterance(text).finally(() => {
      sessionActiveRef.current = false;
      setInSession(false);
      setState('idle');
    });
  };

  const micIcon: IconName = inSession ? 'close' : 'mic';
  const micHint =
    state === 'listening' ? 'Listening… speak now' :
    state === 'thinking'  ? 'Thinking…'            :
    state === 'speaking'  ? 'Clara is speaking…'     :
    'Tap to talk';

  return (
    <div className="cv2-room">
      {/* Status pill — replaces duplicate header; real title is in vis-feature-header */}
      <div className="cv2-status-bar">
        <span className={`cv2-status cv2-status--${state}`}>
          {state === 'listening' ? '● Listening' :
           state === 'thinking'  ? '◌ Thinking…' :
           state === 'speaking'  ? '▶ Speaking'  : 'Ready'}
        </span>
        {llmConnected === false && <span className="cv2-offline">Offline</span>}
      </div>

      <div className="cv2-body studio-scroll">
        {/* Clara avatar */}
        <div className="cv2-avatar-wrap">
          <div className={`cv2-avatar-ring cv2-avatar-ring--${state}`}>
            <img
              src="/recall/clara.png"
              alt="Clara"
              width="110"
              height="110"
              style={{ borderRadius: '50%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
            />
          </div>
          <div className="cv2-avatar-name">
            <span className="cv2-avatar-label">Clara</span>
            <span className={`cv2-avatar-status cv2-avatar-status--${state}`}>
              {state === 'listening' ? 'Listening…' :
               state === 'thinking'  ? 'Thinking…'  :
               state === 'speaking'  ? 'Speaking…'  : 'Ready to talk'}
            </span>
          </div>
        </div>

        <div className="cv2-stage" style={{ display: state === 'listening' ? 'flex' : 'none' }}>
          <div className="cv2-wave" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className="cv2-wave__bar" style={{ animationDelay: `${i * 0.12}s` }} />
            ))}
          </div>
        </div>

        <div className="cv2-speech" aria-live="polite">
          {error     && <p className="cv2-speech__error">{error}</p>}
          {claraLine && <p className="cv2-speech__line">{claraLine}</p>}
        </div>

        <div style={{ flex: 1, minHeight: 16 }} />
      </div>

      <div className="cv2-input-bar">
        <button
          type="button"
          className={`cv2-mic tap-feedback cv2-mic--${state}`}
          onClick={handleMicTap}
          aria-label={inSession ? 'End conversation' : 'Talk to Clara'}
        >
          <span className="cv2-mic__ring" />
          <StudioIcon name={micIcon} size={32} />
        </button>

        <div className="cv2-text-wrap">
          <input
            type="text"
            className="cv2-text-field"
            placeholder="Type to Clara…"
            value={typedInput}
            onChange={(e) => setTypedInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleTextSend(); }}
            aria-label="Type a message to Clara"
            disabled={inSession}
          />
          <button
            type="button"
            className="cv2-send tap-feedback"
            onClick={handleTextSend}
            aria-label="Send"
            style={{ visibility: typedInput.trim() && !inSession ? 'visible' : 'hidden' }}
          >
            <StudioIcon name="send" size={16} />
          </button>
        </div>

        <p className="cv2-mic-hint">{micHint}</p>
      </div>
    </div>
  );
}
