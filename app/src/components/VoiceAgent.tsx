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
import { isIOSBrowser, isNativeIOS, isScreenRecordingActive, preparePlaybackForScreenRecord, releaseMicAfterClara } from '../lib/iosAudioSession';
import StudioIcon, { type IconName } from './StudioIcon';
import ClaraFlowerPulse from './ClaraFlowerPulse';

type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

const POST_SPEAK_PAUSE_MS = 120;
const CASCADE_DELAY_MS = 400;
const CLARA_CONTEXT_TTL_MS = 15_000;
const RECAP_OPEN_DELAY_MS = 1_200;

const SUGGESTIONS = [
  { label: 'What day is it?', icon: '📅' },
  { label: 'Tell me something nice', icon: '✨' },
  { label: "I'm feeling confused", icon: '💙' },
];

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
  const [chatLog, setChatLog] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [screenRecording, setScreenRecording] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

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
    if (!isIOSBrowser()) return;
    let cancelled = false;
    const poll = async () => {
      const captured = await isScreenRecordingActive();
      if (!cancelled) setScreenRecording(captured);
    };
    void poll();
    const timer = window.setInterval(() => { void poll(); }, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

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
    stopListening({ releaseMic: false });
    setClaraLine(response);
    setState('speaking');

    try {
      unlockAudioPlayback();
      if (isNativeIOS()) {
        await preparePlaybackForScreenRecord();
      }
      await speakAloud(response);
    } catch (err) {
      console.error('[Clara TTS] all methods failed:', err);
      setError('Voice is unavailable right now — you can still read my reply below.');
    } finally {
      if (isNativeIOS()) {
        await releaseMicAfterClara();
      }
      await new Promise<void>((r) => setTimeout(r, POST_SPEAK_PAUSE_MS));
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
      await new Promise<void>((r) => setTimeout(r, CASCADE_DELAY_MS));
      sessionActiveRef.current = false;
      setInSession(false);
      setState('idle');
      if (cascade === 'memory_recap') triggerMemoryRecap(recapReason ?? 'disorientation');
      else if (cascade === 'comfort_mode' && !useAppStore.getState().comfortModeActive) activateComfortMode();
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

    setChatLog((prev) =>
      [
        ...prev,
        { role: 'user' as const, content: trimmed },
        { role: 'assistant' as const, content: response },
      ].slice(-8)
    );

    if (user?.id) {
      void logClaraVoiceExchange(user.id, trimmed, response, intent.intent);
    }

    if (!sessionActiveRef.current) return;

    const cascade = intent.cascade;
    const recapReason = intent.recapReason;

    if (cascade === 'memory_recap') {
      void speakResponse(response);
      await new Promise<void>((r) => setTimeout(r, RECAP_OPEN_DELAY_MS));
      triggerMemoryRecap(recapReason ?? 'loneliness', { interruptSpeech: true });
      sessionActiveRef.current = false;
      setInSession(false);
      setState('idle');
      return;
    }

    await speakResponse(response);
    if (cascade === 'comfort_mode') await runCascade('comfort_mode');
  }, [checkRepeatQuestion, user, loadClaraContext, speakResponse, runCascade, firstName, triggerMemoryRecap]);

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
    void processUtterance(text);
  };

  const handleSuggestion = (text: string) => {
    unlockAudioPlayback();
    primeSpeechSynthesis();
    stopSpeaking();
    stopListening();
    sessionActiveRef.current = true;
    setInSession(true);
    setError('');
    void processUtterance(text);
  };

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLog]);

  const micIcon: IconName = inSession ? 'close' : 'mic';

  const statusLabel =
    state === 'listening' ? 'Listening…' :
    state === 'thinking'  ? 'Thinking…'  :
    state === 'speaking'  ? 'Speaking…'  : '';

  return (
    <div className="cv2-room cv2-room--premium">

      <div className="cv2-body cv2-body--premium studio-scroll">

        {/* Avatar + name */}
        <div className="cv2-avatar-wrap cv2-avatar-wrap--premium">

          <div className="cv2-name-block">
            <span className="cv2-name-block__name">Clara</span>
            <span className="cv2-name-block__tag">Your AI Companion</span>
          </div>

          <div className={`cv2-halo cv2-halo--${state}`}>
            <div className="cv2-halo__ring cv2-halo__ring--2" />
            <div className="cv2-halo__ring cv2-halo__ring--1" />
            <div className="cv2-halo__core">
              <img
                src="/recall/clara.png"
                alt="Clara"
                width="140"
                height="140"
                className="cv2-avatar-img"
              />
            </div>
          </div>

          <div
            className={`cv2-pill cv2-pill--${state}${statusLabel ? ' cv2-pill--visible' : ''}`}
            aria-live="polite"
          >
            {state === 'thinking' ? (
              <span className="cv2-thinking-dots"><span /><span /><span /></span>
            ) : (statusLabel || ' ')}
          </div>

          <div className="cv2-flower-hidden" aria-hidden="true">
            <ClaraFlowerPulse active={flowerActive} />
          </div>
        </div>

        {/* Listening wave bars */}
        {state === 'listening' && (
          <div className="cv2-wave cv2-wave--premium" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className="cv2-wave__bar" style={{ animationDelay: `${i * 0.12}s` }} />
            ))}
          </div>
        )}

        {/* Greeting text — only when no chat history */}
        {chatLog.length === 0 && (
          <div className="cv2-speech cv2-speech--premium" aria-live="polite">
            {error     && <p className="cv2-speech__error">{error}</p>}
            {claraLine && <p className="cv2-speech__line">{claraLine}</p>}
          </div>
        )}

        {/* Chat history bubbles */}
        {chatLog.length > 0 && (
          <div className="cv2-chat-log">
            {chatLog.map((entry, i) => (
              <div key={i} className={`cv2-chat-bubble cv2-chat-bubble--${entry.role}`}>
                {entry.content}
              </div>
            ))}
            {state === 'speaking' && claraLine && claraLine !== chatLog[chatLog.length - 1]?.content && (
              <div className="cv2-chat-bubble cv2-chat-bubble--assistant cv2-chat-bubble--active">
                {claraLine}
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>
        )}

        {/* Quick-reply chips — idle only, before first message */}
        {!inSession && chatLog.length === 0 && (
          <div className="cv2-suggestions">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.label}
                type="button"
                className="cv2-suggestion-chip tap-feedback"
                onClick={() => handleSuggestion(s.label)}
              >
                <span className="cv2-suggestion-chip__icon">{s.icon}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        )}

        {llmConnected === false && (
          <span className="cv2-offline cv2-offline--premium">Offline mode</span>
        )}

        <div style={{ flex: 1, minHeight: 24 }} />
      </div>

      {/* Composer */}
      <div className="cv2-composer">
        {screenRecording && !inSession && (
          <p className="cv2-screen-record-hint">
            Screen recording detected — type below to keep your demo audio. Voice works when you are not recording.
          </p>
        )}
        <div className="cv2-composer__card">
          <div className={`cv2-text-wrap cv2-text-wrap--premium${inSession ? ' cv2-text-wrap--disabled' : ''}`}>
            <input
              type="text"
              className="cv2-text-field cv2-text-field--premium"
              placeholder="Message Clara…"
              value={typedInput}
              onChange={(e) => setTypedInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleTextSend(); }}
              aria-label="Type a message to Clara"
              disabled={inSession}
            />
            {typedInput.trim() && !inSession && (
              <button
                type="button"
                className="cv2-send cv2-send--premium tap-feedback"
                onClick={handleTextSend}
                aria-label="Send"
              >
                <StudioIcon name="send" size={15} />
              </button>
            )}
          </div>

          <button
            type="button"
            className={`cv2-mic cv2-mic--premium tap-feedback cv2-mic--${state}`}
            onClick={handleMicTap}
            aria-label={inSession ? 'End conversation' : 'Talk to Clara'}
          >
            <span className="cv2-mic__ring" />
            <StudioIcon name={micIcon} size={26} />
          </button>
        </div>

        {inSession && (
          <button
            type="button"
            className="cv2-end-session tap-feedback"
            onClick={stopSession}
          >
            End conversation
          </button>
        )}
      </div>
    </div>
  );
}
