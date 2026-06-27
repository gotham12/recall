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
  markSupervisorCheckIn,
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

const CONTEXT_TTL_MS = 20_000;
const CONTEXT_REFRESH_MS = 45_000;
const POST_SPEAK_PAUSE_MS = 120;
const LIVE_TICK_DEBOUNCE_MS = 2_000;

function suggestedPrompts(patientFirst: string): string[] {
  return [
    `Explain ${patientFirst}'s ACSE score today`,
    `What should I ask at ${patientFirst}'s next checkup?`,
  ];
}

function voiceSummary(text: string, maxLen = 240): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  const cut = t.slice(0, maxLen);
  const lastStop = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('!'), cut.lastIndexOf('?'));
  return lastStop > 80 ? cut.slice(0, lastStop + 1) : cut + '…';
}

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
  const [booting, setBooting] = useState(false);

  const { startListening, stopListening } = useClaraVoice();
  const contextRef = useRef<RecallAIContextBundle | null>(null);
  const ctxLoadedAtRef = useRef(0);
  const inflightContextRef = useRef<Promise<RecallAIContextBundle | null> | null>(null);
  const historyRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const sessionActiveRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initRef = useRef(false);
  const userIdRef = useRef<number | undefined>(undefined);
  const checkInMarkedRef = useRef(false);

  const caregiverName = user?.caregiverName ?? 'Caregiver';
  const patientFirst = user?.name?.split(' ')[0] ?? 'Margaret';
  const preprompts = suggestedPrompts(patientFirst);

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

  const loadContext = useCallback(async (force = false): Promise<RecallAIContextBundle | null> => {
    if (!user?.id) return null;

    const now = Date.now();
    if (!force && contextRef.current && now - ctxLoadedAtRef.current < CONTEXT_TTL_MS) {
      return contextRef.current;
    }

    if (inflightContextRef.current) {
      return inflightContextRef.current;
    }

    const promise = buildRecallAIContext(user, acseScore, comfortModeActive)
      .then((bundle) => {
        contextRef.current = bundle;
        ctxLoadedAtRef.current = Date.now();
        setContextReady(true);
        return bundle;
      })
      .finally(() => {
        inflightContextRef.current = null;
      });

    inflightContextRef.current = promise;
    return promise;
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
    if (!user?.id || liveDataTick === undefined) return;
    const timer = window.setTimeout(() => {
      void loadContext(true);
    }, LIVE_TICK_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [user?.id, liveDataTick, loadContext]);

  useEffect(() => {
    if (!user?.id) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadContext(true);
      }
    }, CONTEXT_REFRESH_MS);
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
    if (!user?.id) return;
    if (userIdRef.current !== user.id) {
      userIdRef.current = user.id;
      initRef.current = false;
      checkInMarkedRef.current = false;
      setMessages([]);
      setContextReady(false);
      contextRef.current = null;
      ctxLoadedAtRef.current = 0;
      historyRef.current = [];
    }
    if (initRef.current) return;
    initRef.current = true;

    const boot = async () => {
      setBooting(true);
      try {
        const bundle = await loadContext(true);
        if (!bundle) return;

        const snap = bundle.snapshot;
        const localBrief = localSupervisorBriefing(snap);
        const welcome = `Hello ${caregiverName}. I'm Recall AI — your specialist advisor for ${patientFirst}'s care. Here's today's briefing:\n\n${localBrief}\n\nAsk me anything about treatment, medications, cognitive changes, or care planning.`;

        appendMessage('assistant', welcome);
        setContextReady(true);

        void (async () => {
          try {
            const context = formatBriefingContext(snap);
            const result = await generateSupervisorBriefing(context, localBrief);
            if (!result.fromLlm) return;
            const briefing = validateBriefingAgainstSnapshot(result.text, snap);
            setLlmConnected(true);
            const enhanced = `Hello ${caregiverName}. I'm Recall AI — your specialist advisor for ${patientFirst}'s care. Here's today's briefing:\n\n${briefing}\n\nAsk me anything about treatment, medications, cognitive changes, or care planning.`;
            setMessages((prev) => {
              if (!prev.length) return prev;
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (last.role === 'assistant') {
                copy[copy.length - 1] = { ...last, content: enhanced };
                historyRef.current = [{ role: 'assistant', content: enhanced }];
              }
              return copy;
            });
          } catch (err) {
            console.warn('[Recall AI] Background briefing polish failed:', err);
          }
        })();
      } catch (err) {
        console.error('[Recall AI boot]', err);
        appendMessage(
          'assistant',
          `Hello ${caregiverName}. I'm Recall AI. I had trouble loading the full briefing, but I can still answer care questions using live patient data. What would you like to know?`
        );
        setContextReady(true);
      } finally {
        setBooting(false);
      }
    };

    void boot();
  }, [user?.id, caregiverName, patientFirst, loadContext, appendMessage]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const speakReply = useCallback(async (response: string) => {
    stopListening();
    setState('speaking');
    try {
      unlockAudioPlayback();
      await speak(voiceSummary(response), { advisor: true });
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
  }, [stopListening]);

  const processMessage = useCallback(async (text: string, speakAloud = false) => {
    const trimmed = text.trim();
    if (!trimmed || !user?.id) return;

    if (!checkInMarkedRef.current) {
      markSupervisorCheckIn(user.id);
      checkInMarkedRef.current = true;
    }

    setError('');
    appendMessage('user', trimmed);
    setState('thinking');

    const cached = contextRef.current;
    const cacheFresh = cached && Date.now() - ctxLoadedAtRef.current < CONTEXT_TTL_MS;
    const bundlePromise = cacheFresh ? Promise.resolve(cached) : loadContext(true);
    if (cacheFresh) {
      void loadContext(true);
    }

    const bundle = await bundlePromise;
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
        await new Promise<void>((r) => setTimeout(r, 300));
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
    void loadContext();
    sessionActiveRef.current = true;
    setInSession(true);
    setError('');
    void runConversation();
  }, [inSession, stopSession, runConversation, loadContext]);

  const handleTextSend = () => {
    const text = typedInput.trim();
    if (!text || inSession || !contextReady) return;
    setTypedInput('');
    stopSpeaking();
    void processMessage(text, false);
  };

  const handlePrompt = (prompt: string) => {
    if (inSession || !contextReady) return;
    stopSpeaking();
    void processMessage(prompt, false);
  };

  const handleRefreshContext = async () => {
    await loadContext(true);
    appendMessage('assistant', `I've refreshed ${patientFirst}'s live data. What would you like to know?`);
  };

  const micIcon: IconName = inSession ? 'close' : 'mic';
  const statusHint =
    state === 'listening' ? 'Listening… speak now' :
    state === 'thinking'  ? 'Thinking…' :
    state === 'speaking'  ? 'Speaking…' :
    booting ? 'Loading briefing…' : '';
  const canSend = typedInput.trim().length > 0 && !inSession && contextReady && !booting;

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
             state === 'speaking'  ? '▶ Speaking' : booting ? '◌ Loading' : 'Ready'}
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
        aria-busy={state === 'thinking' || booting}
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

        {(state === 'thinking' || booting) && messages.length === 0 && (
          <div className="rai-bubble rai-bubble--assistant rai-bubble--typing">
            <div className="rai-bubble__avatar"><StudioIcon name="brain" size={16} /></div>
            <div className="rai-typing"><span /><span /><span /></div>
          </div>
        )}

        {state === 'thinking' && messages.length > 0 && (
          <div className="rai-bubble rai-bubble--assistant rai-bubble--typing">
            <div className="rai-bubble__avatar"><StudioIcon name="brain" size={16} /></div>
            <div className="rai-typing"><span /><span /><span /></div>
          </div>
        )}

        {showPrompts && !inSession && contextReady && !booting && messages.length <= 2 && (
          <div className="rai-prompts">
            {preprompts.map((p) => (
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
              disabled={inSession || !contextReady || booting}
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
