import { useState, useRef, useCallback, FormEvent } from 'react';
import { useVoice } from '../hooks/useVoice';
import { useACSE } from '../hooks/useACSE';
import { claraChat } from '../services/groq';
import { useAppStore } from '../store/appStore';
import { db } from '../db/db';
import StudioIcon from './StudioIcon';
import { speak, stopSpeaking } from '../services/elevenlabs';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

export default function VoiceAgent() {
  const user = useAppStore((s) => s.user);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'listening' | 'thinking'>('idle');
  const { startListening } = useVoice();
  const { checkRepeatQuestion, recordActivity } = useACSE();
  const historyRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || status === 'thinking') return;

    checkRepeatQuestion(trimmed);
    recordActivity();
    setStatus('thinking');
    setTurns((prev) => [...prev, { role: 'user', content: trimmed }]);
    setInput('');

    try {
      const ctx = await buildContext(user?.id ?? 1);
      const response = await claraChat(
        trimmed,
        historyRef.current,
        user?.name ?? 'Margaret',
        ctx
      );

      historyRef.current = [
        ...historyRef.current,
        { role: 'user' as const, content: trimmed },
        { role: 'assistant' as const, content: response },
      ].slice(-20);

      setTurns((prev) => [...prev, { role: 'assistant', content: response }]);
    } catch (err) {
      console.error(err);
      setTurns((prev) => [
        ...prev,
        { role: 'assistant', content: "I'm having trouble right now. Please try again in a moment." },
      ]);
    } finally {
      setStatus('idle');
      inputRef.current?.focus();
    }
  }, [status, checkRepeatQuestion, recordActivity, user]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  const handleMicTap = useCallback(async () => {
    if (status !== 'idle') return;

    try {
      setStatus('listening');
      const transcript = await startListening();
      if (!transcript.trim()) {
        setStatus('idle');
        return;
      }
      setStatus('idle');
      await sendMessage(transcript);
    } catch (err) {
      console.error(err);
      setStatus('idle');
    }
  }, [status, startListening, sendMessage]);

  const statusLabel =
    status === 'listening' ? 'Listening…' :
    status === 'thinking' ? 'Clara is thinking…' :
    'Type a question for Clara';

  return (
    <div className="clara-chat">
      <div className="studio-scroll clara-chat__messages">
        {turns.length === 0 && (
          <div className="clara-chat__empty">
            <div className="clara-chat__empty-icon">
              <StudioIcon name="chat" size={36} />
            </div>
            <p className="studio-text-bright" style={{ fontSize: 20 }}>Hi, I'm Clara.</p>
            <p className="studio-text-muted" style={{ fontSize: 17 }}>
              Type your question below — no need to speak.
            </p>
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className={`clara-chat__row clara-chat__row--${t.role}`}>
            <div style={{ maxWidth: '82%', display: 'flex', flexDirection: 'column', gap: 6, alignItems: t.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div
                className={t.role === 'user' ? 'studio-bubble-user' : 'studio-bubble-assistant'}
                style={{
                  padding: '12px 16px',
                  borderRadius: t.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  fontSize: 18,
                  lineHeight: 1.5,
                }}
              >
                {t.content}
              </div>
              {t.role === 'assistant' && (
                <button
                  type="button"
                  className="studio-icon-btn tap-feedback"
                  onClick={() => { stopSpeaking(); void speak(t.content); }}
                  aria-label="Listen to Clara"
                  style={{ padding: '6px 10px', fontSize: 13 }}
                >
                  <StudioIcon name="speaker" size={16} />
                  <span style={{ marginLeft: 6 }}>Listen</span>
                </button>
              )}
            </div>
          </div>
        ))}
        {status === 'thinking' && (
          <div className="clara-chat__row clara-chat__row--assistant">
            <div className="studio-bubble-assistant clara-chat__thinking">
              <StudioIcon name="thinking" size={20} />
            </div>
          </div>
        )}
      </div>

      <form className="clara-chat__composer" onSubmit={handleSubmit}>
        <p className="studio-text-muted clara-chat__status">{statusLabel}</p>
        <div className="clara-chat__input-row">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Clara anything…"
            className="studio-input clara-chat__input"
            disabled={status === 'thinking' || status === 'listening'}
            autoComplete="off"
          />
          <button
            type="submit"
            className="clara-chat__send tap-feedback"
            disabled={!input.trim() || status !== 'idle'}
            aria-label="Send message"
          >
            <StudioIcon name="send" size={20} />
          </button>
          <button
            type="button"
            onClick={() => void handleMicTap()}
            className={`clara-chat__mic tap-feedback ${status === 'listening' ? 'clara-chat__mic--active mic-listening' : ''}`}
            disabled={status === 'thinking'}
            aria-label="Speak to Clara"
          >
            <StudioIcon name="mic" size={20} />
          </button>
        </div>
      </form>
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
