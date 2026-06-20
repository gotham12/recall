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
import StudioIcon, { type IconName } from './StudioIcon';
import ClaraFlowerPulse from './ClaraFlowerPulse';

type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

const POST_SPEAK_PAUSE_MS = 800;
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
  const [typedInput, setTypedInput] = useState('');

  const { startListening, stopListening } = useClaraVoice();
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
      console.error('[Clara TTS]', err);
    }
    await new Promise<void>((r) => setTimeout(r, POST_SPEAK_PAUSE_MS));
    if (sessionActiveRef.current || force) setState('idle');
  }, [stopListening]);

  const runCascade = useCallback(
    async (cascade: 'memory_recap' | 'comfort_mode', recapReason?: MemoryRecapReason) => {
      if (!sessionActiveRef.current) return;
      await new Promise<void>((r) => setTimeout(r, CASCADE_DELAY_MS));
      sessionActiveRef.current = false;
      setInSession(false);
      setState('idle');
      if (cascade === 'memory_recap') triggerMemoryRecap(recapReason ?? 'disorientation');
      else if (cascade === 'comfort_mode') activateComfortMode();
    },
    [triggerMemoryRecap, activateComfortMode]
  );

  const processUtterance = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      if (sessionActiveRef.current) setClaraLine("I didn't catch that — take your time and try again.");
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

    if (!sessionActiveRef.current) return;
    await speakResponse(response);

    if (intent.cascade === 'memory_recap') await runCascade('memory_recap', intent.recapReason);
    else if (intent.cascade === 'comfort_mode') await runCascade('comfort_mode');
  }, [checkRepeatQuestion, user, acseScore, speakResponse, runCascade]);

  const runSingleTurn = useCallback(async () => {
    // Loop: listen → think → speak → listen → … until session ends
    while (sessionActiveRef.current) {
      try {
        stopSpeaking();
        await new Promise<void>((r) => setTimeout(r, 150));
        if (!sessionActiveRef.current) break;

        setState('listening');
        setClaraLine("I'm listening…");
        setError('');

        const heard = await startListening();
        if (!sessionActiveRef.current) break;

        if (!heard.trim()) {
          // Nothing heard — keep looping so Clara stays ready
          setClaraLine("I'm still listening — go ahead.");
          continue;
        }

        await processUtterance(heard);
        // After speaking, loop back to listen again (if still active)
      } catch (err) {
        console.error('[Clara voice]', err);
        if (!sessionActiveRef.current) break;
        const msg = (err instanceof Error ? err.message : '').toLowerCase();
        if (msg.includes('denied') || msg.includes('not-allowed') || msg.includes('permission')) {
          setError('Please allow microphone access — tap the mic icon in your browser address bar.');
          setClaraLine('Once the mic is allowed, tap below and we can talk.');
          sessionActiveRef.current = false;
          setInSession(false);
          setState('idle');
          return;
        } else if (msg.includes('network') || msg.includes('fetch') || msg.includes('transcri')) {
          setClaraLine("Having trouble connecting. Check your internet and try again.");
        } else {
          setClaraLine("I didn't quite catch that — try again.");
        }
        // On non-fatal errors, keep the loop going
        await new Promise<void>((r) => setTimeout(r, 800));
      }
    }
    // Session ended
    sessionActiveRef.current = false;
    setInSession(false);
    setState('idle');
  }, [startListening, processUtterance]);

  const handleMicTap = useCallback(() => {
    unlockAudioPlayback();
    if (inSession) { stopSession(); return; }
    stopSpeaking();
    sessionActiveRef.current = true;
    setInSession(true);
    setError('');
    void runSingleTurn();
  }, [inSession, stopSession, runSingleTurn]);

  const handleTextSend = () => {
    const text = typedInput.trim();
    if (!text || inSession) return;
    setTypedInput('');
    unlockAudioPlayback();
    stopSpeaking();
    stopListening();
    sessionActiveRef.current = true;
    setInSession(true);
    setError('');
    void processUtterance(text).finally(() => {
      sessionActiveRef.current = false;
      setInSession(false);
    });
  };

  const micIcon: IconName = (state === 'thinking' || state === 'speaking') ? 'close' : 'mic';
  const micHint =
    state === 'listening' ? 'Listening… speak now' :
    state === 'thinking'  ? 'Thinking…'            :
    state === 'speaking'  ? 'Tap to stop'          :
    'Tap to talk';

  return (
    <div className="cv2-room">

      {/* ── Top bar ── */}
      <header className="cv2-header">
        <div className="cv2-header__dot cv2-header__dot--idle" />
        <span className="cv2-header__name">Clara</span>
        <span className={`cv2-status cv2-status--${state}`}>
          {state === 'listening' ? '● Listening' :
           state === 'thinking'  ? '◌ Thinking…' :
           state === 'speaking'  ? '▶ Speaking'  : 'Ready'}
        </span>
        {llmConnected === false && <span className="cv2-offline">Offline</span>}
      </header>

      {/* ── Scrollable body ── */}
      <div className="cv2-body studio-scroll">

        {/* Flower + wave */}
        <div className="cv2-stage">
          <ClaraFlowerPulse active={flowerActive} size={120} className="cv2-flower" />
          {state === 'listening' && (
            <div className="cv2-wave" aria-hidden>
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="cv2-wave__bar"
                  style={{ animationDelay: `${i * 0.12}s` }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Speech / status text */}
        <div className="cv2-speech" aria-live="polite">
          {error     && <p className="cv2-speech__error">{error}</p>}
          {claraLine && <p className="cv2-speech__line">{claraLine}</p>}
        </div>

        <div style={{ flex: 1, minHeight: 16 }} />
      </div>

      {/* ── Bottom input bar ── */}
      <div className="cv2-input-bar">
        <button
          type="button"
          className={`cv2-mic tap-feedback cv2-mic--${state}`}
          onClick={handleMicTap}
          aria-label={state !== 'idle' ? 'Stop' : 'Talk to Clara'}
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
            disabled={inSession && state !== 'idle'}
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
