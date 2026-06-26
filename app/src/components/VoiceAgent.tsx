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
import {
  speak,
  stopSpeaking,
  unlockAudioPlayback,
  primeSpeechSynthesis,
} from '../services/elevenlabs';
import { addRoutineEvent, parseRoutineUtterance } from '../lib/routineUtils';
import StudioIcon, { type IconName } from './StudioIcon';
import ClaraFlowerPulse from './ClaraFlowerPulse';

type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

const POST_SPEAK_PAUSE_MS = 500;
const CASCADE_DELAY_MS = 1_800;

async function speakAloud(text: string): Promise<void> {
  unlockAudioPlayback();
  await speak(text, { clara: true });
}

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
      if (sessionActiveRef.current) setClaraLine("I didn't catch that — go ahead.");
      return;
    }

    checkRepeatQuestion(trimmed);
    setError('');
    setState('thinking');
    setClaraLine('One moment…');

    const intent = detectClaraIntent(trimmed);
    const ctx = await buildClaraRichContext(user, acseScore);
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

    if (!sessionActiveRef.current) return;
    await speakResponse(response);

    if (intent.cascade === 'memory_recap') await runCascade('memory_recap', intent.recapReason);
    else if (intent.cascade === 'comfort_mode') await runCascade('comfort_mode');
  }, [checkRepeatQuestion, user, acseScore, speakResponse, runCascade, firstName]);

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
    sessionActiveRef.current = true;
    setInSession(true);
    setError('');
    void runConversation();
  }, [inSession, stopSession, runConversation]);

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
            <svg viewBox="0 0 120 120" width="110" height="110" aria-hidden>
              {/* Background circle */}
              <circle cx="60" cy="60" r="58" fill="#F5EEE8"/>
              {/* Hair - back */}
              <ellipse cx="60" cy="42" rx="32" ry="34" fill="#2C1B0E"/>
              {/* Neck */}
              <rect x="51" y="82" width="18" height="16" rx="4" fill="#E8B89A"/>
              {/* Face */}
              <ellipse cx="60" cy="60" rx="27" ry="30" fill="#F0C8A8"/>
              {/* Hair - front / fringe */}
              <path d="M33 46 Q36 22 60 20 Q84 22 87 46 Q80 34 60 32 Q40 34 33 46Z" fill="#2C1B0E"/>
              {/* Side hair strands */}
              <path d="M33 54 Q28 68 30 82 Q34 78 36 72 Q33 65 33 54Z" fill="#2C1B0E"/>
              <path d="M87 54 Q92 68 90 82 Q86 78 84 72 Q87 65 87 54Z" fill="#2C1B0E"/>
              {/* Eyebrows */}
              <path d="M47 47 Q52 44 57 46" stroke="#4A2E1A" strokeWidth="2" fill="none" strokeLinecap="round"/>
              <path d="M63 46 Q68 44 73 47" stroke="#4A2E1A" strokeWidth="2" fill="none" strokeLinecap="round"/>
              {/* Eyes */}
              <ellipse cx="52" cy="54" rx="5.5" ry="6" fill="#fff"/>
              <ellipse cx="68" cy="54" rx="5.5" ry="6" fill="#fff"/>
              <circle cx="53" cy="55" r="4" fill="#3D2010"/>
              <circle cx="69" cy="55" r="4" fill="#3D2010"/>
              <circle cx="54.5" cy="53.5" r="1.5" fill="white"/>
              <circle cx="70.5" cy="53.5" r="1.5" fill="white"/>
              {/* Eyelashes */}
              <path d="M47 50 L45 47M49 49 L48 46M51 49 L51 46" stroke="#2C1B0E" strokeWidth="1.2" strokeLinecap="round"/>
              <path d="M63 49 L62 46M65 49 L65 46M68 50 L70 47" stroke="#2C1B0E" strokeWidth="1.2" strokeLinecap="round"/>
              {/* Nose */}
              <path d="M58 60 Q60 65 62 60" stroke="#D4956A" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              <circle cx="57" cy="66" r="2" fill="#E8A880" opacity="0.5"/>
              <circle cx="63" cy="66" r="2" fill="#E8A880" opacity="0.5"/>
              {/* Mouth */}
              <path d="M53 73 Q60 79 67 73" stroke="#C47A5A" strokeWidth="2" fill="none" strokeLinecap="round"/>
              <path d="M55 73 Q60 76 65 73" fill="#E8786A" opacity="0.7"/>
              {/* Cheek blush */}
              <ellipse cx="43" cy="68" rx="7" ry="4" fill="#F0A0A0" opacity="0.35"/>
              <ellipse cx="77" cy="68" rx="7" ry="4" fill="#F0A0A0" opacity="0.35"/>
              {/* Shoulders */}
              <path d="M20 120 Q20 96 60 92 Q100 96 100 120Z" fill="#6B8FD0"/>
              {/* Shirt collar */}
              <path d="M52 92 L60 100 L68 92" stroke="#5577BB" strokeWidth="2" fill="none"/>
            </svg>
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
