import { useState, useRef, useCallback } from 'react';
import { useVoice } from '../hooks/useVoice';
import { useACSE } from '../hooks/useACSE';
import { claraChat } from '../services/groq';
import { speak, stopSpeaking } from '../services/elevenlabs';
import { useAppStore } from '../store/appStore';
import { db } from '../db/db';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

export default function VoiceAgent() {
  const user = useAppStore((s) => s.user);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [status, setStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const { startListening } = useVoice();
  const { checkRepeatQuestion, recordActivity } = useACSE();
  const historyRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);

  const handleMicTap = useCallback(async () => {
    if (status !== 'idle') {
      stopSpeaking();
      setStatus('idle');
      return;
    }

    try {
      setStatus('listening');
      const transcript = await startListening();
      if (!transcript.trim()) {
        setStatus('idle');
        return;
      }

      checkRepeatQuestion(transcript);
      recordActivity();
      setStatus('thinking');
      setTurns((prev) => [...prev, { role: 'user', content: transcript }]);

      const ctx = await buildContext(user?.id ?? 1);
      const response = await claraChat(transcript, historyRef.current, user?.name ?? 'Margaret', ctx);

      historyRef.current = [
        ...historyRef.current,
        { role: 'user' as const, content: transcript },
        { role: 'assistant' as const, content: response },
      ].slice(-20);

      setTurns((prev) => [...prev, { role: 'assistant', content: response }]);
      setStatus('speaking');
      await speak(response);
      setStatus('idle');
    } catch (err) {
      console.error(err);
      setStatus('idle');
    }
  }, [status, startListening, checkRepeatQuestion, recordActivity, user]);

  const micLabel =
    status === 'listening' ? 'Listening…' :
    status === 'thinking'  ? 'Thinking…' :
    status === 'speaking'  ? 'Speaking — tap to stop' :
    'Tap to talk with Clara';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="studio-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {turns.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>💬</div>
            <p className="studio-text-bright" style={{ fontSize: 20 }}>Hi, I'm Clara.</p>
            <p className="studio-text-muted" style={{ fontSize: 17 }}>Tap the microphone when you're ready to talk.</p>
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: t.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div
              className={t.role === 'user' ? 'studio-bubble-user' : 'studio-bubble-assistant'}
              style={{
                maxWidth: '82%',
                padding: '12px 16px',
                borderRadius: t.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                fontSize: 18,
                lineHeight: 1.5,
              }}
            >
              {t.content}
            </div>
          </div>
        ))}
      </div>

      <div className="studio-mic-bar">
        <p className="studio-text-muted" style={{ fontSize: 16, margin: 0 }}>{micLabel}</p>
        <button
          onClick={handleMicTap}
          className={`studio-mic-btn tap-feedback ${status === 'listening' ? 'mic-listening studio-mic-btn--active' : ''}`}
        >
          {status === 'thinking' ? '⋯' : status === 'speaking' ? '🔊' : '🎙️'}
        </button>
      </div>
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
