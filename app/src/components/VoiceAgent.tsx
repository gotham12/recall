import { useState, useRef, useCallback, useEffect } from 'react';
import { useVoice } from '../hooks/useVoice';
import { useACSE } from '../hooks/useACSE';
import { claraChat } from '../services/groq';
import { speak, stopSpeaking } from '../services/elevenlabs';
import { useAppStore } from '../store/appStore';
import { db } from '../db/db';

type Status = 'idle' | 'listening' | 'thinking' | 'speaking';
interface Turn { role: 'user' | 'assistant'; content: string; }
interface Msg  { role: 'system' | 'user' | 'assistant'; content: string; }

export default function VoiceAgent() {
  const user = useAppStore((s) => s.user);
  const [turns, setTurns]         = useState<Turn[]>([]);
  const [status, setStatus]       = useState<Status>('idle');
  const [errMsg, setErrMsg]       = useState('');
  const [textInput, setTextInput] = useState('');
  const [speechAvail, setSpeechAvail] = useState(false);
  const { startListening, stopListening } = useVoice();
  const { checkRepeatQuestion, recordActivity } = useACSE();
  const historyRef = useRef<Msg[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);

  // Detect speech recognition availability on mount
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hasSTT = !!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition;
    // Web Speech API requires HTTPS or localhost
    const isSecure = location.protocol === 'https:' || location.hostname === 'localhost';
    setSpeechAvail(hasSTT && isSecure);
  }, []);

  const sendMessage = useCallback(async (transcript: string) => {
    if (!transcript.trim()) return;
    setErrMsg('');
    checkRepeatQuestion(transcript);
    recordActivity();
    setTurns(p => [...p, { role: 'user', content: transcript }]);
    setStatus('thinking');

    try {
      const now    = new Date();
      const events = user?.id ? await db.events.where('userId').equals(user.id).toArray() : [];
      const completed = events.filter(e => e.completed).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      const upcoming  = events.filter(e => !e.completed && new Date(e.timestamp) > now).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      const ctx = {
        recentEvents:   completed.slice(0, 5).map(e => `${e.title} at ${new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`),
        upcomingEvents: upcoming.slice(0, 3).map(e => `${e.title} at ${new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`),
      };

      const response = await claraChat(transcript, historyRef.current, user?.name ?? 'Margaret', ctx);
      historyRef.current = [...historyRef.current, { role: 'user' as const, content: transcript }, { role: 'assistant' as const, content: response }].slice(-20);
      setTurns(p => [...p, { role: 'assistant', content: response }]);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

      // Speak response — failures only silence voice, they don't hide the text
      try {
        setStatus('speaking');
        await speak(response);
      } catch (voiceErr) {
        console.error('[Voice] ElevenLabs failed:', voiceErr);
        setErrMsg('Voice unavailable — Clara replied in text above.');
      }
      setStatus('idle');

    } catch (e) {
      console.error('[Clara] error:', e);
      setStatus('idle');
      const msg = e instanceof Error ? e.message : String(e);
      setErrMsg(`Could not reach Clara: ${msg}`);
    }
  }, [checkRepeatQuestion, recordActivity, user]);

  const handleMic = useCallback(async () => {
    setErrMsg('');
    if (status === 'speaking') { stopSpeaking(); setStatus('idle'); return; }
    if (status === 'listening') { stopListening(); setStatus('idle'); return; }
    if (status === 'thinking') return;

    try {
      setStatus('listening');
      const transcript = await startListening();
      if (transcript) await sendMessage(transcript);
      else setStatus('idle');
    } catch (e: unknown) {
      setStatus('idle');
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'aborted') return;
      setErrMsg(msg.includes('denied') ? 'Microphone access denied. Please type your message below.' : msg);
    }
  }, [status, startListening, stopListening, sendMessage]);

  const handleTextSend = async () => {
    if (!textInput.trim() || status === 'thinking') return;
    const t = textInput;
    setTextInput('');
    inputRef.current?.focus();
    await sendMessage(t);
  };

  const micColor = status === 'listening' ? '#15803D' : status === 'speaking' ? '#0D9488' : '#16A34A';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Chat transcript */}
      <div className="scroll-area" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {turns.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 24px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 60, height: 60, borderRadius: 18, background: 'var(--green-dim)', border: '1px solid rgba(22,163,74,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="1.8" strokeLinecap="round">
                <rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0014 0M12 19v3M8 22h8"/>
              </svg>
            </div>
            <div className="t-overline" style={{ color: 'var(--green)' }}>AI Voice Companion</div>
            <div style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 20, color: 'var(--text)' }}>Hello, I am Clara</div>
            <p className="t-body" style={{ maxWidth: 280, fontSize: 14 }}>
              {speechAvail
                ? 'Type a message or tap the microphone to speak.'
                : 'Type a message below and I will respond with my voice.'}
            </p>
            {!speechAvail && (
              <div style={{ background: '#FEF9C3', border: '1px solid #FDE047', borderRadius: 12, padding: '10px 14px', maxWidth: 280 }}>
                <p style={{ fontSize: 12, color: '#854D0E', margin: 0, fontFamily: 'Inter', fontWeight: 500 }}>
                  Voice input requires HTTPS. Use the Vercel link for full microphone support, or type below.
                </p>
              </div>
            )}
          </div>
        )}

        {turns.map((t, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: t.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 8 }}>
            {t.role === 'assistant' && (
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                  <rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0014 0"/>
                </svg>
              </div>
            )}
            <div style={{
              maxWidth: '78%', padding: '12px 16px', fontSize: 16, lineHeight: 1.6,
              borderRadius: t.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              background: t.role === 'user' ? 'var(--green)' : '#FFFFFF',
              color: t.role === 'user' ? 'white' : 'var(--text)',
              boxShadow: t.role === 'user' ? '0 2px 8px rgba(22,163,74,0.22)' : '0 1px 6px rgba(0,0,0,0.07)',
              border: t.role === 'assistant' ? '1px solid rgba(22,163,74,0.12)' : 'none',
            }}>
              {t.content}
            </div>
          </div>
        ))}

        {/* Thinking indicator */}
        {status === 'thinking' && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                <rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0014 0"/>
              </svg>
            </div>
            <div style={{ background: '#FFFFFF', border: '1px solid rgba(22,163,74,0.12)', borderRadius: '18px 18px 18px 4px', padding: '14px 18px', display: 'flex', gap: 5 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', animation: `dotBounce 1.2s ease ${i*0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Error message */}
      {errMsg && (
        <div style={{ padding: '10px 16px', background: '#FEF2F2', borderTop: '1px solid #FECACA', flexShrink: 0 }}>
          <p style={{ fontSize: 13, color: 'var(--danger)', margin: 0, fontFamily: 'Inter' }}>{errMsg}</p>
        </div>
      )}

      {/* Status bar when listening/speaking */}
      {(status === 'listening' || status === 'speaking') && (
        <div style={{ padding: '8px 16px', background: status === 'listening' ? '#F0FDF4' : '#ECFDF5', borderTop: '1px solid rgba(22,163,74,0.15)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', animation: 'dotBounce 1s ease infinite' }} />
          <span style={{ fontSize: 13, color: 'var(--green)', fontFamily: 'Inter', fontWeight: 600 }}>
            {status === 'listening' ? 'Listening — speak now...' : 'Clara is speaking...'}
          </span>
          {status === 'listening' && (
            <button onClick={() => { stopListening(); setStatus('idle'); }}
              style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter', fontWeight: 600 }}>
              Cancel
            </button>
          )}
          {status === 'speaking' && (
            <button onClick={() => { stopSpeaking(); setStatus('idle'); }}
              style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter', fontWeight: 600 }}>
              Stop
            </button>
          )}
        </div>
      )}

      {/* Input dock — always visible */}
      <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.98)', borderTop: '1px solid rgba(22,163,74,0.10)', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
        {/* Mic button — only shown when speech is available */}
        {speechAvail && (
          <button
            onClick={handleMic}
            disabled={status === 'thinking'}
            className={status === 'listening' ? 'mic-active' : ''}
            style={{
              width: 48, height: 48, borderRadius: '50%', border: 'none', flexShrink: 0,
              background: micColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: status === 'thinking' ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 8px rgba(22,163,74,0.30)',
              transition: 'background 200ms, transform 100ms',
              opacity: status === 'thinking' ? 0.5 : 1,
            }}>
            {status === 'listening' ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <rect x="6" y="6" width="12" height="12" rx="2"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                <rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0014 0M12 19v3M8 22h8"/>
              </svg>
            )}
          </button>
        )}

        {/* Text input */}
        <input
          ref={inputRef}
          value={textInput}
          onChange={e => setTextInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleTextSend()}
          placeholder="Message Clara..."
          disabled={status === 'thinking'}
          style={{
            flex: 1, padding: '12px 14px', borderRadius: 999,
            border: '1.5px solid rgba(22,163,74,0.18)',
            fontSize: 15, outline: 'none', background: '#F8FDF9',
            fontFamily: 'Inter', color: 'var(--text)',
            transition: 'border-color 150ms',
          }}
          onFocus={e => e.currentTarget.style.borderColor = 'rgba(22,163,74,0.45)'}
          onBlur={e => e.currentTarget.style.borderColor = 'rgba(22,163,74,0.18)'}
        />

        {/* Send button */}
        <button
          onClick={handleTextSend}
          disabled={!textInput.trim() || status === 'thinking'}
          style={{
            width: 48, height: 48, borderRadius: '50%', border: 'none', flexShrink: 0,
            background: textInput.trim() && status !== 'thinking' ? 'var(--green)' : '#E5E7EB',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: textInput.trim() && status !== 'thinking' ? 'pointer' : 'not-allowed',
            transition: 'background 200ms',
          }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>

      <style>{`
        @keyframes dotBounce {
          0%,100%{transform:translateY(0);opacity:.5}
          50%{transform:translateY(-4px);opacity:1}
        }
      `}</style>
    </div>
  );
}
