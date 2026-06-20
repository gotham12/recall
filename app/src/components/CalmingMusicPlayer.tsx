import { useEffect, useRef, useState } from 'react';
import StudioIcon from './StudioIcon';

/** Tibetan bowl frequencies (Hz) — authentic sacred ratios */
const BOWL_FREQS = [108, 216, 324, 432, 540, 648];

function buildTibetanBellEngine(ctx: AudioContext): { master: GainNode; stop: () => void } {
  const nodes: AudioNode[] = [];
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.18, ctx.currentTime);
  master.connect(ctx.destination);
  nodes.push(master);

  // 40Hz binaural gamma layer
  const carrier = ctx.createOscillator();
  carrier.type = 'sine';
  carrier.frequency.setValueAtTime(220, ctx.currentTime);
  const modulator = ctx.createOscillator();
  modulator.type = 'sine';
  modulator.frequency.setValueAtTime(40, ctx.currentTime);
  const modGain = ctx.createGain();
  modGain.gain.setValueAtTime(0.035, ctx.currentTime);
  const carrierGain = ctx.createGain();
  carrierGain.gain.setValueAtTime(0.055, ctx.currentTime);
  modulator.connect(modGain);
  modGain.connect(carrier.frequency);
  carrier.connect(carrierGain);
  carrierGain.connect(master);
  carrier.start();
  modulator.start();
  nodes.push(carrier, modulator, modGain, carrierGain);

  let loopId: ReturnType<typeof setInterval> | null = null;
  let t = ctx.currentTime + 0.8;

  function strike(freq: number, time: number, amp: number) {
    const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.setValueAtTime(freq, time);
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.setValueAtTime(freq * 2.756, time);

    const revLen = ctx.sampleRate * 2.5;
    const revBuf = ctx.createBuffer(2, revLen, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = revBuf.getChannelData(ch);
      for (let i = 0; i < revLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / revLen, 2.2) * 0.35;
    }
    const reverb = ctx.createConvolver(); reverb.buffer = revBuf;

    const g1 = ctx.createGain(); g1.gain.setValueAtTime(amp, time); g1.gain.exponentialRampToValueAtTime(0.0001, time + 5);
    const g2 = ctx.createGain(); g2.gain.setValueAtTime(amp * 0.3, time); g2.gain.exponentialRampToValueAtTime(0.0001, time + 3);

    o1.connect(g1); g1.connect(reverb);
    o2.connect(g2); g2.connect(reverb);
    reverb.connect(master);

    o1.start(time); o1.stop(time + 5.5);
    o2.start(time); o2.stop(time + 3.5);
    nodes.push(o1, o2, g1, g2, reverb);
  }

  const scheduleNext = () => {
    const freq = BOWL_FREQS[Math.floor(Math.random() * BOWL_FREQS.length)];
    strike(freq, t, 0.20);
    if (Math.random() > 0.5) strike(BOWL_FREQS[Math.floor(Math.random() * BOWL_FREQS.length)], t + 0.15, 0.09);
    t += 3.5 + Math.random() * 4.5;
  };

  for (let i = 0; i < 3; i++) scheduleNext();
  loopId = setInterval(() => scheduleNext(), 4000 + Math.random() * 3000);

  const stop = () => {
    if (loopId) clearInterval(loopId);
    try { master.gain.setValueAtTime(0, ctx.currentTime); } catch {}
    nodes.forEach(n => { try { (n as AudioScheduledSourceNode).stop?.(); } catch {} });
  };

  return { master, stop };
}

interface Props {
  /** Ignored — we always use Tibetan bell synthesis */
  url?: string;
  label?: string;
}

/** Plays authentic Tibetan bowl tones with 40Hz binaural gamma layer. */
export default function CalmingMusicPlayer({ label = 'Tibetan Bells · 40Hz' }: Props) {
  const [playing, setPlaying] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  const toggle = () => {
    if (playing) {
      stopRef.current?.();
      ctxRef.current?.close();
      ctxRef.current = null;
      stopRef.current = null;
      setPlaying(false);
    } else {
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') void ctx.resume();
        const { stop } = buildTibetanBellEngine(ctx);
        ctxRef.current = ctx;
        stopRef.current = stop;
        setPlaying(true);
      } catch (err) {
        console.warn('[CalmingMusicPlayer] Audio init failed:', err);
      }
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRef.current?.();
      ctxRef.current?.close();
    };
  }, []);

  return (
    <div className="calming-music">
      <button type="button" className="calming-music__btn tap-feedback" onClick={toggle}>
        <StudioIcon name={playing ? 'speaker' : 'music'} size={22} />
        <span>{playing ? 'Pause bells' : label}</span>
        {playing && <span style={{ fontSize: 11, opacity: 0.65, marginLeft: 4 }}>♪</span>}
      </button>
    </div>
  );
}
