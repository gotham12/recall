import { useState, useRef, useCallback, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useClaraVoice } from '../../hooks/useClaraVoice';
import { useAppStore } from '../../store/appStore';
import type { User } from '../../db/db';
import { db } from '../../db/db';
import { buildRecallAIContext, type RecallAIContextBundle } from '../../lib/recallAIContext';
import {
  formatBriefingContext,
  localSupervisorBriefing,
  validateBriefingAgainstSnapshot,
} from '../../lib/supervisorBriefing';
import { recallAIChat, generateSupervisorBriefing } from '../../services/groq';
import {
  speak,
  stopSpeaking,
  unlockAudioPlayback,
  primeSpeechSynthesis,
} from '../../services/elevenlabs';
import StudioIcon, { type IconName } from '../StudioIcon';

type AgentState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const CONTEXT_REFRESH_MS = 20_000;
const POST_SPEAK_PAUSE_MS = 400;
const SUGGESTED_PROMPTS = [
  'Explain her ACSE score today',
  'What should I ask at her next checkup?',
];

interface Props {
  user: User | null;
}

function msgId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function RecallAIChat({ user }: Props) {
  const acseScore = useAppStore((s) => s.acseScore);
  const comfortModeActive = useAppStore((s) => s.comfortModeActive);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [state, setState] = useState<AgentState>('idle');
  const [inSession, setInSession] = useState(false);
  const [typedInput, setTypedInput] = useState('');
  const [error, setError] = useState('');
  const [llmConnected, setLlmConnected] = useState<boolean | null>(null);
  const [contextReady, setContextReady] = useState(false);
  const [showPrompts, setShowPrompts] = useState(true);

  const { startListening, stopListening } = useClaraVoice();
  const contextRef = useRef<RecallAIContextBundle | null>(null);
  const historyRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const sessionActiveRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initRef = useRef(false);

  const caregiverName = user?.caregiverName ?? 'Caregiver';
  const patientFirst = user?.name?.split(' ')[0] ?? 'Margaret';

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    });
  }, []);

  const appendMessage = useCallback((role: 'user' | 'assistant', content: string) => {
    const msg: ChatMessage = { id: msgId(), role, content };
    setMessages((prev) => [...prev, msg]);
    if (role === 'user' || role === 'assistant') {
      historyRef.current = [...historyRef.current, { role, content }].slice(-20);
    }
    if (role === 'user') setShowPrompts(false);
    scrollToBottom();
    return msg;
  }, [scrollToBottom]);

  const loadContext = useCallback(async () => {
    if (!user?.id) return null;
    const bundle = await buildRecallAIContext(user, acseScore, comfortModeActive);
    contextRef.current = bundle;
    setContextReady(true);
    return bundle;
  }, [user, acseScore, comfortModeActive]);

  const liveDataTick = useLiveQuery(
    async () => {
      if (!user?.id) return 0;
      const [events, medLogs, routines] = await Promise.all([
        db.events.where('userId').equals(user.id).count(),
        db.medicationLogs.where('userId').equals(user.id).count(),
        db.routineTasks.where('userId').equals(user.id).count(),
      ]);
      return events + medLogs + routines;
    },
    [user?.id]
  );

  useEffect(() => {
    if (!user?.id) return;
    void loadContext();
  }, [user?.id, acseScore, comfortModeActive, liveDataTick, loadContext]);

  useEffect(() => {
    if (!user?.id) return;
    const timer = window.setInterval(() => { void loadContext(); }, CONTEXT_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [user?.id, loadContext]);

  useEffect(() => {
    unlockAudioPlayback();
    primeSpeechSynthesis();
    return () => {
      sessionActiveRef.current = false;
      stopSpeaking();
      stopListening();
    };
  }, [stopListening]);

  useEffect(() => {
    if (!user?.id || initRef.current) return;
    initRef.current = true;

    const boot = async () => {
      setState('thinking');
      try {
        const bundle = await loadContext();
        if (!bundle) return;

        const snap = bundle.snapshot;
        const context = formatBriefingContext(snap);
        const fallback = localSupervisorBriefing(snap);
        const result = await generateSupervisorBriefing(context, fallback);
        const briefing = result.fromLlm
          ? validateBriefingAgainstSnapshot(result.text, snap)
          : result.text;

        setLlmConnected(result.fromLlm);

        const welcome = `Hello ${caregiverName}. I'm Recall AI — your specialist advisor for ${patientFirst}'s care. Here's today's briefing:\n\n${briefing}\n\nAsk me anything about treatment, medications, cognitive changes, or care planning.`;

        appendMessage('assistant', welcome);

        unlockAudioPlayback();
        void speak(
          `Hello ${caregiverName}. I've reviewed ${patientFirst}'s day. Ask me anything about her care.`,
          { clara: true }
        ).catch(() => undefined);
      } catch (err) {
        console.error('[Recall AI boot]', err);
        appendMessage(
          'assistant',
          `Hello ${caregiverName}. I'm Recall AI. I had trouble loading the full briefing, but I can still answer care questions using live patient data. What would you like to know?`
        );
      } finally {
        setState('idle');
      }
    };

    void boot();
  }, [user?.id, caregiverName, patientFirst, loadContext, appendMessage]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const speakReply = useCallback(async (response: string) => {
    setState('speaking');
    try {
      unlockAudioPlayback();
      await speak(response, { clara: true });
    } catch (err) {
      console.error('[Recall AI TTS]', err);
    } finally {
      await new Promise<void>((r) => setTimeout(r, POST_SPEAK_PAUSE_MS));
      if (sessionActiveRef.current) {
        setState('listening');
      } else {
        setState('idle');
      }
    }
  }, []);

  const processMessage = useCallback(async (text: string, speakAloud = true) => {
    const trimmed = text.trim();
    if (!trimmed || !user?.id) return;

    setError('');
    appendMessage('user', trimmed);
    setState('thinking');

    await loadContext();
    const bundle = contextRef.current;
    if (!bundle) {
      setError('Patient context not loaded yet.');
      setState('idle');
      return;
    }

    try {
      const result = await recallAIChat(
        trimmed,
        historyRef.current.slice(0, -1),
        bundle.contextBlock,
        caregiverName,
        bundle.snapshot
      );
      setLlmConnected(result.fromLlm);
      appendMessage('assistant', result.reply);

      if (speakAloud) {
        await speakReply(result.reply);
      } else {
        setState('idle');
      }
    } catch (err) {
      console.error('[Recall AI]', err);
      const fallback = `I'm having trouble connecting right now, ${caregiverName}. Try again in a moment, or check the Overview tab for live data.`;
      appendMessage('assistant', fallback);
      setState('idle');
    }
  }, [user?.id, appendMessage, loadContext, caregiverName, speakReply]);

  const runConversation = useCallback(async () => {
    while (sessionActiveRef.current) {
      try {
        setState('listening');
        setError('');

        const heard = await startListening();
        if (!sessionActiveRef.current) break;
        if (!heard.trim()) continue;

        await processMessage(heard, true);
      } catch (err) {
        console.error('[Recall AI voice]', err);
        if (!sessionActiveRef.current) break;
        const msg = (err instanceof Error ? err.message : '').toLowerCase();
        if (msg.includes('denied') || msg.includes('not-allowed')) {
          setError('Allow microphone access in browser settings.');
          sessionActiveRef.current = false;
          setInSession(false);
          setState('idle');
          return;
        }
        setState('listening');
        await new Promise<void>((r) => setTimeout(r, 500));
      }
    }
    sessionActiveRef.current = false;
    setInSession(false);
    setState('idle');
  }, [startListening, processMessage]);

  const stopSession = useCallback(() => {
    sessionActiveRef.current = false;
    setInSession(false);
    stopSpeaking();
    stopListening();
    setState('idle');
    setError('');
  }, [stopListening]);

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
    if (!text || inSession || !contextReady) return;
    setTypedInput('');
    unlockAudioPlayback();
    primeSpeechSynthesis();
    void processMessage(text, true);
  };

  const handlePrompt = (prompt: string) => {
    if (inSession || !contextReady) return;
    unlockAudioPlayback();
    void processMessage(prompt, true);
  };

  const handleRefreshContext = async () => {
    await loadContext();
    appendMessage('assistant', `I've refreshed ${patientFirst}'s live data. What would you like to know?`);
  };

  const micIcon: IconName = inSession ? 'close' : 'mic';
  const statusHint =
    state === 'listening' ? 'Listening… speak now' :
    state === 'thinking'  ? 'Thinking…' :
    state === 'speaking'  ? 'Speaking…' :
    '';
  const canSend = typedInput.trim().length > 0 && !inSession && contextReady;

  return (
    <div className="rai-room">
      <div className="rai-header">
        <div className="rai-header__brand">
          <div className="rai-header__icon" aria-hidden>
            <StudioIcon name="brain" size={20} />
          </div>
          <div>
            <p className="rai-header__eyebrow">Care Advisor</p>
            <h2 className="rai-header__title">Recall AI</h2>
          </div>
        </div>
        <div className="rai-header__meta">
          <span className={`rai-status rai-status--${state}`}>
            {state === 'listening' ? '● Listening' :
             state === 'thinking'  ? '◌ Thinking' :
             state === 'speaking'  ? '▶ Speaking' : 'Ready'}
          </span>
          {llmConnected === false && <span className="rai-offline">Offline</span>}
          <button type="button" className="rai-refresh tap-feedback" onClick={() => void handleRefreshContext()} aria-label="Refresh patient data">
            <StudioIcon name="refresh" size={16} />
          </button>
        </div>
      </div>

      <div
        className="rai-messages studio-scroll"
        ref={scrollRef}
        aria-busy={state === 'thinking'}
        aria-live="polite"
      >
        {messages.map((m) => (
          <div key={m.id} className={`rai-bubble rai-bubble--${m.role}`}>
            {m.role === 'assistant' && (
              <div className="rai-bubble__avatar" aria-hidden>
                <StudioIcon name="brain" size={16} />
              </div>
            )}
            <div className="rai-bubble__body">
              <p className="rai-bubble__text">{m.content}</p>
            </div>
          </div>
        ))}

        {state === 'thinking' && (
          <div className="rai-bubble rai-bubble--assistant rai-bubble--typing">
            <div className="rai-bubble__avatar"><StudioIcon name="brain" size={16} /></div>
            <div className="rai-typing"><span /><span /><span /></div>
          </div>
        )}

        {showPrompts && !inSession && contextReady && messages.length <= 2 && (
          <div className="rai-prompts">
            {SUGGESTED_PROMPTS.map((p) => (
              <button key={p} type="button" className="rai-prompt-chip tap-feedback" onClick={() => handlePrompt(p)}>
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rai-input-bar">
        {error && <p className="rai-input-bar__error" role="alert">{error}</p>}

        <button
          type="button"
          className={`rai-mic tap-feedback rai-mic--${state}`}
          onClick={handleMicTap}
          aria-label={inSession ? 'End voice session' : 'Talk to Recall AI'}
        >
          <span className="rai-mic__ring" />
          <StudioIcon name={micIcon} size={26} />
        </button>

        <div className="rai-compose">
          <div className="rai-text-wrap">
            <input
              type="text"
              className="rai-text-field"
              placeholder={`Ask about ${patientFirst}'s care…`}
              value={typedInput}
              onChange={(e) => setTypedInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleTextSend(); }}
              disabled={inSession || !contextReady}
              aria-label="Type a question to Recall AI"
            />
            <button
              type="button"
              className="rai-send tap-feedback"
              onClick={handleTextSend}
              aria-label="Send"
              disabled={!canSend}
            >
              <StudioIcon name="send" size={16} />
            </button>
          </div>
          {statusHint ? (
            <p className="rai-mic-hint">{statusHint}</p>
          ) : (
            <p className="rai-disclaimer">
              Not medical advice — confirm with {patientFirst}'s physician.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
