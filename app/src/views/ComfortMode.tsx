import { useState, useEffect, useRef, useCallback } from 'react';
import BreathingCircle from '../components/BreathingCircle';
import StudioIcon from '../components/StudioIcon';
import { useAppStore } from '../store/appStore';
import { generateGrounding, generateNarrative } from '../services/groq';
import { speak, stopSpeaking } from '../services/elevenlabs';
import { db } from '../db/db';

type Phase = 'grounding' | 'breathing' | 'narrative' | 'done';

// ── Tibetan Bell Synthesizer ─────────────────────────────────────────────────
// Authentic Tibetan bowl frequencies (multiples of 108Hz) + 40Hz gamma binaural layer

function startTibetanBells(volumeTarget = 0.22): () => void {
  let ctx: AudioContext | null = null;
  const nodes: AudioNode[] = [];
  let loopId: ReturnType<typeof setInterval> | null = null;

  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AudioCtx();
    if (ctx.state === 'suspended') ctx.resume();

    const master = ctx.createGain();
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(volumeTarget, ctx.currentTime + 2.5);
    master.connect(ctx.destination);
    nodes.push(master);

    // 40Hz binaural beat: left ear 200Hz, right ear 240Hz (merged mono for web)
    // Gentle carrier at 220Hz modulated at 40Hz (gamma entrainment simulation)
    const binauralOsc = ctx.createOscillator();
    binauralOsc.type = 'sine';
    binauralOsc.frequency.setValueAtTime(220, ctx.currentTime);
    const binauralMod = ctx.createOscillator();
    binauralMod.type = 'sine';
    binauralMod.frequency.setValueAtTime(40, ctx.currentTime);
    const binauralGain = ctx.createGain();
    binauralGain.gain.setValueAtTime(0.06, ctx.currentTime);
    const modGain = ctx.createGain();
    modGain.gain.setValueAtTime(0.04, ctx.currentTime);
    binauralMod.connect(modGain);
    modGain.connect(binauralOsc.frequency);
    binauralOsc.connect(binauralGain);
    binauralGain.connect(master);
    binauralOsc.start();
    binauralMod.start();
    nodes.push(binauralOsc, binauralMod, binauralGain, modGain);

    // Tibetan bowl strike function
    const BOWL_FREQS = [108, 216, 324, 432, 540, 648, 756];
    function strike(freq: number, time: number, amp: number) {
      if (!ctx) return;
      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq, time);

      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq * 2.756, time);

      const osc3 = ctx.createOscillator();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(freq * 5.404, time);

      // Convolver for natural room reverb
      const revLen = ctx.sampleRate * 3;
      const revBuf = ctx.createBuffer(2, revLen, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = revBuf.getChannelData(ch);
        for (let i = 0; i < revLen; i++) {
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / revLen, 2.5) * 0.4;
        }
      }
      const reverb = ctx.createConvolver();
      reverb.buffer = revBuf;

      const g1 = ctx.createGain();
      g1.gain.setValueAtTime(amp, time);
      g1.gain.exponentialRampToValueAtTime(0.0001, time + 5.5);

      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(amp * 0.35, time);
      g2.gain.exponentialRampToValueAtTime(0.0001, time + 3.2);

      const g3 = ctx.createGain();
      g3.gain.setValueAtTime(amp * 0.12, time);
      g3.gain.exponentialRampToValueAtTime(0.0001, time + 1.8);

      osc1.connect(g1); g1.connect(reverb);
      osc2.connect(g2); g2.connect(reverb);
      osc3.connect(g3); g3.connect(reverb);
      reverb.connect(master);

      osc1.start(time); osc1.stop(time + 6);
      osc2.start(time); osc2.stop(time + 4);
      osc3.start(time); osc3.stop(time + 2.5);
      nodes.push(osc1, osc2, osc3, g1, g2, g3, reverb);
    }

    // Schedule initial bells
    const now = ctx.currentTime;
    let t = now + 1.5;
    const scheduleNext = () => {
      if (!ctx) return;
      const freq = BOWL_FREQS[Math.floor(Math.random() * BOWL_FREQS.length)];
      strike(freq, t, 0.22);
      // Occasional harmony
      if (Math.random() > 0.55) {
        const harmFreq = BOWL_FREQS[Math.floor(Math.random() * BOWL_FREQS.length)];
        strike(harmFreq, t + 0.12, 0.10);
      }
      t += 3.5 + Math.random() * 5;
    };
    for (let i = 0; i < 4; i++) scheduleNext();

    loopId = setInterval(() => scheduleNext(), 4500 + Math.random() * 3500);

  } catch (err) {
    console.warn('[ComfortMode] Tibetan bells failed to start:', err);
  }

  return () => {
    if (loopId) clearInterval(loopId);
    if (ctx) {
      try { nodes.forEach(n => { try { (n as AudioScheduledSourceNode).stop?.(); } catch {} }); } catch {}
      try { ctx.close(); } catch {}
    }
  };
}

// ── Nature Backdrop ─────────────────────────────────────────────────────────
// Pre-defined positions to avoid Math.random() re-render drift
const PARTICLES = [
  { x: 12, y: 15, s: 5, d: 7.2, del: 0.0 },
  { x: 28, y: 72, s: 3, d: 9.1, del: 1.4 },
  { x: 45, y: 38, s: 7, d: 6.8, del: 2.2 },
  { x: 62, y: 88, s: 4, d: 11.0, del: 0.7 },
  { x: 78, y: 22, s: 6, d: 8.3, del: 3.1 },
  { x: 90, y: 55, s: 3, d: 7.6, del: 1.9 },
  { x: 35, y: 10, s: 5, d: 10.4, del: 0.4 },
  { x: 55, y: 65, s: 8, d: 9.7, del: 2.8 },
  { x: 18, y: 85, s: 4, d: 6.5, del: 1.1 },
  { x: 72, y: 42, s: 6, d: 8.0, del: 3.5 },
  { x: 88, y: 78, s: 3, d: 11.5, del: 0.9 },
  { x: 42, y: 55, s: 5, d: 7.9, del: 2.5 },
  { x: 8,  y: 48, s: 4, d: 9.3, del: 1.7 },
  { x: 65, y: 12, s: 7, d: 8.8, del: 0.2 },
  { x: 32, y: 92, s: 3, d: 10.1, del: 3.8 },
  { x: 82, y: 33, s: 5, d: 7.4, del: 1.3 },
  { x: 50, y: 78, s: 4, d: 9.0, del: 2.9 },
  { x: 22, y: 60, s: 6, d: 8.5, del: 0.6 },
];

function NatureBackdrop() {
  return (
    <div className="nature-backdrop" aria-hidden>
      {/* Layered aurora gradients */}
      <div className="nature-backdrop__aurora nature-backdrop__aurora--1" />
      <div className="nature-backdrop__aurora nature-backdrop__aurora--2" />
      <div className="nature-backdrop__aurora nature-backdrop__aurora--3" />

      {/* Expanding ripple rings */}
      <div className="nature-backdrop__ripple nature-backdrop__ripple--1" />
      <div className="nature-backdrop__ripple nature-backdrop__ripple--2" />
      <div className="nature-backdrop__ripple nature-backdrop__ripple--3" />

      {/* Floating petals / light motes */}
      {PARTICLES.map((p, i) => (
        <div
          key={i}
          className="nature-backdrop__mote"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.s,
            height: p.s,
            animationDuration: `${p.d}s`,
            animationDelay: `${p.del}s`,
          }}
        />
      ))}
    </div>
  );
}

// ── Main ComfortMode Component ─────────────────────────────────────────────────
export default function ComfortMode() {
  const { user, deactivateComfortMode } = useAppStore();
  const [phase, setPhase] = useState<Phase>('grounding');
  const [groundingText, setGroundingText] = useState('');
  const [narrativeText, setNarrativeText] = useState('');
  const [loading, setLoading] = useState(true);
  const stopBellsRef = useRef<(() => void) | null>(null);

  const exitComfort = useCallback(() => {
    stopSpeaking();
    stopBellsRef.current?.();
    deactivateComfortMode();
  }, [deactivateComfortMode]);

  // Start Tibetan bells immediately on mount
  useEffect(() => {
    const stopFn = startTibetanBells(0.18);
    stopBellsRef.current = stopFn;
    return () => {
      stopFn();
      stopSpeaking();
    };
  }, []);

  // Fetch grounding & narrative text
  useEffect(() => {
    const init = async () => {
      if (!user?.id) return;
      setLoading(true);

      const events = await db.events
        .where('userId').equals(user.id)
        .and((e) => e.completed)
        .toArray();

      const ctx = {
        recentEvents: events
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 5)
          .map((e) => e.title),
        upcomingEvents: [] as string[],
      };

      try {
        const grounding = await generateGrounding(user.name, user.city, ctx);
        setGroundingText(grounding);

        // Delay voice slightly to not clash with bells onset
        await new Promise<void>((r) => setTimeout(r, 2000));
        await speak(grounding, { clara: true });

        const narrative = await generateNarrative(user.name, ctx.recentEvents);
        setNarrativeText(narrative);
      } catch {
        setGroundingText(
          `You are safe at home in ${user?.city ?? 'your home'}. Everything is okay. Take a slow breath with me.`
        );
        setNarrativeText('Today has been a gentle day. You are resting peacefully at home.');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [user]);

  const handleBreathingComplete = useCallback(async () => {
    await speak(narrativeText || 'You have done beautifully. You are safe and loved.', { clara: true });
    setPhase('narrative');
  }, [narrativeText]);

  const skipToNarrative = useCallback(async () => {
    stopSpeaking();
    const text = narrativeText || 'You are safe and loved. Today has been a gentle day.';
    await speak(text, { clara: true });
    setPhase('narrative');
  }, [narrativeText]);

  const caregiverLabel = user?.caregiverName ? `Call ${user.caregiverName}` : 'Call caregiver';
  const firstName = user?.name?.split(' ')[0] ?? 'there';

  return (
    <div className="comfort-mode-v2" style={{ zIndex: 50 }}>
      {/* Nature backdrop — always visible */}
      <NatureBackdrop />

      {/* Soft scrim over backdrop */}
      <div className="comfort-mode-v2__scrim" />

      {/* Close button — always accessible */}
      <button
        type="button"
        className="comfort-mode-v2__close tap-feedback"
        onClick={exitComfort}
        aria-label="Exit comfort mode"
      >
        <StudioIcon name="close" size={20} />
      </button>

      {/* Content */}
      <div className="comfort-mode-v2__content">

        {/* Bell indicator */}
        <div className="comfort-mode-v2__bell-badge">
          <span className="comfort-mode-v2__bell-pulse" />
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>Tibetan Bells · 40Hz</span>
        </div>

        {phase === 'grounding' && (
          <div className="animate-fadeIn comfort-mode-v2__card">
            {loading ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div className="comfort-mode-v2__loading-dot" />
                <p style={{ color: 'rgba(255,255,255,0.55)', marginTop: 12, fontSize: 15 }}>Clara is here…</p>
              </div>
            ) : (
              <>
                <p className="comfort-mode-v2__text">{groundingText}</p>
                <div className="comfort-mode-v2__actions">
                  <button
                    className="comfort-mode-v2__btn comfort-mode-v2__btn--primary tap-feedback"
                    onClick={() => {
                      void speak(`Let's breathe together, ${firstName}. Follow the circle.`, { clara: true });
                      setPhase('breathing');
                    }}
                  >
                    Breathe with me
                  </button>
                  <button
                    className="comfort-mode-v2__btn comfort-mode-v2__btn--ghost tap-feedback"
                    onClick={() => void skipToNarrative()}
                  >
                    Skip to reassurance
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {phase === 'breathing' && (
          <div className="animate-fadeIn comfort-mode-v2__card">
            <p className="comfort-mode-v2__breathe-heading">Breathe with me, {firstName}</p>
            <BreathingCircle cycles={3} onComplete={handleBreathingComplete} />
            <button
              className="comfort-mode-v2__btn comfort-mode-v2__btn--ghost tap-feedback"
              onClick={() => void skipToNarrative()}
              style={{ marginTop: 12 }}
            >
              Skip breathing
            </button>
          </div>
        )}

        {phase === 'narrative' && (
          <div className="animate-fadeIn comfort-mode-v2__card">
            <p className="comfort-mode-v2__text">{narrativeText}</p>
            <div className="comfort-mode-v2__actions">
              <button className="comfort-mode-v2__btn comfort-mode-v2__btn--primary tap-feedback" onClick={exitComfort}>
                I'm feeling better
              </button>
              {user?.caregiverName && (
                <a
                  href={`tel:${user?.caregiverPhone ?? '+15555550100'}`}
                  className="comfort-mode-v2__btn comfort-mode-v2__btn--ghost tap-feedback"
                >
                  <StudioIcon name="user" size={16} />
                  <span>{caregiverLabel}</span>
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
