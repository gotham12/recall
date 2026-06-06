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
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [status, setStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const { isListening, startListening } = useVoice();
  const { checkRepeatQuestion, recordActivity } = useACSE();
  const historyRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);

  const handleMicTap = useCallback(async () => {
    if (status !== 'idle') {
      stopSpeaking();
      setStatus('idle');
      setIsSpeaking(false);
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

      // Build event context
      const ctx = await buildContext(user?.id ?? 1);
      const response = await claraChat(
        transcript,
        historyRef.current,
        user?.name ?? 'Margaret',
        ctx
      );

      historyRef.current = [
        ...historyRef.current,
        { role: 'user' as const, content: transcript },
        { role: 'assistant' as const, content: response },
      ].slice(-20);

      setTurns((prev) => [...prev, { role: 'assistant', content: response }]);

      setStatus('speaking');
      setIsSpeaking(true);
      await speak(response);
      setStatus('idle');
      setIsSpeaking(false);
    } catch (err) {
      console.error(err);
      setStatus('idle');
      setIsSpeaking(false);
    }
  }, [status, startListening, checkRepeatQuestion, recordActivity, user]);

  const micLabel =
    status === 'listening' ? 'Listening...' :
    status === 'thinking'  ? 'Thinking...' :
    status === 'speaking'  ? 'Speaking (tap to stop)' :
    'Tap to talk to Clara';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Transcript */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {turns.length === 0 && (
          <div style={{ textAlign: 'center', color: '#8A9AB0', marginTop: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
            <p style={{ fontSize: 20 }}>
              Hi, I'm Clara. I'm here to help you.
            </p>
            <p style={{ fontSize: 18, opacity: 0.7 }}>
              Tap the microphone to start talking.
            </p>
          </div>
        )}
        {turns.map((t, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: t.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '80%',
                padding: '12px 16px',
                borderRadius:
                  t.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                background: t.role === 'user' ? 'linear-gradient(135deg, #2196F3, #0057CC)' : 'white',
                color: t.role === 'user' ? 'white' : '#1A2B4A',
                fontSize: 20,
                lineHeight: 1.5,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}
            >
              {t.content}
            </div>
          </div>
        ))}
      </div>

      {/* Mic button */}
      <div
        style={{
          padding: '20px 16px',
          paddingBottom: 'max(20px, var(--sab))',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          background: '#F8F4EF',
          borderTop: '1px solid #E5D5C0',
        }}
      >
        <p style={{ fontSize: 18, color: '#6B7A8D', margin: 0 }}>{micLabel}</p>
        <button
          onClick={handleMicTap}
          className={status === 'listening' ? 'mic-listening' : ''}
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background:
              status === 'idle'
                ? 'linear-gradient(135deg, #2196F3, #0057CC)'
                : status === 'listening'
                ? '#0057CC'
                : status === 'thinking'
                ? '#6B7A8D'
                : '#10B981',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 32,
            boxShadow: '0 4px 20px rgba(33,150,243,0.4)',
            transition: 'background 0.3s ease, transform 0.1s ease',
          }}
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
