import { useEffect, useRef, useState } from 'react';

interface Sound {
  id: string;
  label: string;
  emoji: string;
  color: string;
  description: string;
  make: (ctx: AudioContext) => () => void;
}

function makeRain(ctx: AudioContext): () => void {
  const nodes: AudioNode[] = [];
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.18, ctx.currentTime);
  master.connect(ctx.destination);
  nodes.push(master);

  for (let i = 0; i < 6; i++) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let j = 0; j < data.length; j++) data[j] = (Math.random() * 2 - 1) * 0.8;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800 + i * 300, ctx.currentTime);
    filter.Q.setValueAtTime(0.4, ctx.currentTime);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08 + Math.random() * 0.06, ctx.currentTime);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(ctx.currentTime + i * 0.08);
    nodes.push(src, filter, gain);
  }

  return () => {
    try { master.gain.setValueAtTime(0, ctx.currentTime); } catch {}
    nodes.forEach(n => { try { (n as AudioScheduledSourceNode).stop?.(); } catch {} });
  };
}

function makeOcean(ctx: AudioContext): () => void {
  const nodes: AudioNode[] = [];
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.22, ctx.currentTime);
  master.connect(ctx.destination);
  nodes.push(master);

  const bufSize = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  noise.loop = true;

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(400, ctx.currentTime);

  const lfo = ctx.createOscillator();
  lfo.frequency.setValueAtTime(0.12, ctx.currentTime);
  const lfoGain = ctx.createGain();
  lfoGain.gain.setValueAtTime(120, ctx.currentTime);
  lfo.connect(lfoGain);
  lfoGain.connect(lp.frequency);

  const waveGain = ctx.createGain();
  waveGain.gain.setValueAtTime(0.35, ctx.currentTime);

  noise.connect(lp);
  lp.connect(waveGain);
  waveGain.connect(master);

  noise.start();
  lfo.start();
  nodes.push(noise, lp, lfo, lfoGain, waveGain);

  return () => {
    try { master.gain.setValueAtTime(0, ctx.currentTime); } catch {}
    nodes.forEach(n => { try { (n as AudioScheduledSourceNode).stop?.(); } catch {} });
  };
}

function makeForest(ctx: AudioContext): () => void {
  const nodes: AudioNode[] = [];
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.15, ctx.currentTime);
  master.connect(ctx.destination);
  nodes.push(master);

  function chirp(freq: number, time: number) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.linearRampToValueAtTime(freq * 1.3, time + 0.08);
    osc.frequency.linearRampToValueAtTime(freq, time + 0.15);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(0.12, time + 0.02);
    g.gain.linearRampToValueAtTime(0, time + 0.18);
    osc.connect(g);
    g.connect(master);
    osc.start(time);
    osc.stop(time + 0.25);
    nodes.push(osc, g);
  }

  const baseFreqs = [2800, 3200, 2400, 3600, 2600];
  const now = ctx.currentTime;
  for (let t = 0; t < 20; t += 0.4 + Math.random() * 0.8) {
    const freq = baseFreqs[Math.floor(Math.random() * baseFreqs.length)];
    chirp(freq, now + t);
    if (Math.random() > 0.5) chirp(freq * 0.95, now + t + 0.1);
  }

  const windBuf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
  const wd = windBuf.getChannelData(0);
  for (let i = 0; i < wd.length; i++) wd[i] = Math.random() * 2 - 1;
  const windSrc = ctx.createBufferSource();
  windSrc.buffer = windBuf;
  windSrc.loop = true;
  const windFilter = ctx.createBiquadFilter();
  windFilter.type = 'bandpass';
  windFilter.frequency.setValueAtTime(500, now);
  windFilter.Q.setValueAtTime(0.2, now);
  const windGain = ctx.createGain();
  windGain.gain.setValueAtTime(0.06, now);
  windSrc.connect(windFilter);
  windFilter.connect(windGain);
  windGain.connect(master);
  windSrc.start();
  nodes.push(windSrc, windFilter, windGain);

  const loopId = setInterval(() => {
    const t = ctx.currentTime;
    const freq = baseFreqs[Math.floor(Math.random() * baseFreqs.length)];
    chirp(freq, t + 0.05);
    if (Math.random() > 0.5) chirp(freq * 0.95, t + 0.15);
  }, 800 + Math.random() * 1200);

  return () => {
    clearInterval(loopId);
    try { master.gain.setValueAtTime(0, ctx.currentTime); } catch {}
    nodes.forEach(n => { try { (n as AudioScheduledSourceNode).stop?.(); } catch {} });
  };
}

function makeBells(ctx: AudioContext): () => void {
  const nodes: AudioNode[] = [];
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.2, ctx.currentTime);
  master.connect(ctx.destination);
  nodes.push(master);

  const TIBETAN_FREQS = [108, 216, 324, 432, 540, 648];

  function strike(freq: number, time: number, amp: number) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2.75, time);
    const g1 = ctx.createGain();
    g1.gain.setValueAtTime(amp, time);
    g1.gain.exponentialRampToValueAtTime(0.0001, time + 4.5);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(amp * 0.3, time);
    g2.gain.exponentialRampToValueAtTime(0.0001, time + 2.5);
    const reverb = ctx.createConvolver();
    const revLen = ctx.sampleRate * 2;
    const revBuf = ctx.createBuffer(2, revLen, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = revBuf.getChannelData(ch);
      for (let i = 0; i < revLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / revLen, 3);
    }
    reverb.buffer = revBuf;
    osc.connect(g1); g1.connect(reverb);
    osc2.connect(g2); g2.connect(reverb);
    reverb.connect(master);
    osc.start(time); osc.stop(time + 5);
    osc2.start(time); osc2.stop(time + 3);
    nodes.push(osc, osc2, g1, g2, reverb);
  }

  const now = ctx.currentTime;
  let t = now;
  const schedule = () => {
    const freq = TIBETAN_FREQS[Math.floor(Math.random() * TIBETAN_FREQS.length)];
    strike(freq, t, 0.18);
    if (Math.random() > 0.6) strike(freq * 1.5, t + 0.08, 0.08);
    t += 3 + Math.random() * 4;
  };

  for (let i = 0; i < 5; i++) schedule();

  const loopId = setInterval(() => {
    schedule();
  }, 3500 + Math.random() * 3000);

  return () => {
    clearInterval(loopId);
    try { master.gain.setValueAtTime(0, ctx.currentTime); } catch {}
    nodes.forEach(n => { try { (n as AudioScheduledSourceNode).stop?.(); } catch {} });
  };
}

function makeFire(ctx: AudioContext): () => void {
  const nodes: AudioNode[] = [];
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.2, ctx.currentTime);
  master.connect(ctx.destination);
  nodes.push(master);

  const bufSize = ctx.sampleRate * 3;
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(900, ctx.currentTime);

  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.setValueAtTime(80, ctx.currentTime);

  const lfo = ctx.createOscillator();
  lfo.frequency.setValueAtTime(0.5, ctx.currentTime);
  const lfoG = ctx.createGain();
  lfoG.gain.setValueAtTime(200, ctx.currentTime);
  lfo.connect(lfoG);
  lfoG.connect(lp.frequency);

  src.connect(hp); hp.connect(lp); lp.connect(master);
  src.start();
  lfo.start();
  nodes.push(src, lp, hp, lfo, lfoG);

  return () => {
    try { master.gain.setValueAtTime(0, ctx.currentTime); } catch {}
    nodes.forEach(n => { try { (n as AudioScheduledSourceNode).stop?.(); } catch {} });
  };
}

function makeWhiteNoise(ctx: AudioContext): () => void {
  const nodes: AudioNode[] = [];
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.15, ctx.currentTime);
  master.connect(ctx.destination);
  nodes.push(master);

  const bufSize = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.connect(master);
  src.start();
  nodes.push(src);

  return () => {
    try { master.gain.setValueAtTime(0, ctx.currentTime); } catch {}
    nodes.forEach(n => { try { (n as AudioScheduledSourceNode).stop?.(); } catch {} });
  };
}

function makeStream(ctx: AudioContext): () => void {
  const nodes: AudioNode[] = [];
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.2, ctx.currentTime);
  master.connect(ctx.destination);
  nodes.push(master);

  const bufSize = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;

  const layers: [number, number, number][] = [
    [600, 0.3, 0.1], [1200, 0.5, 0.07], [2400, 0.2, 0.05],
  ];
  layers.forEach(([freq, q, amp]) => {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq, ctx.currentTime);
    filter.Q.setValueAtTime(q, ctx.currentTime);
    const g = ctx.createGain();
    g.gain.setValueAtTime(amp, ctx.currentTime);
    src.connect(filter); filter.connect(g); g.connect(master);
    src.start(ctx.currentTime + Math.random() * 0.1);
    nodes.push(src, filter, g);
  });

  return () => {
    try { master.gain.setValueAtTime(0, ctx.currentTime); } catch {}
    nodes.forEach(n => { try { (n as AudioScheduledSourceNode).stop?.(); } catch {} });
  };
}

const SOUNDS: Sound[] = [
  { id: 'rain',    label: 'Rain',          emoji: '🌧️', color: '#5AC8FA', description: 'Gentle rainfall', make: makeRain },
  { id: 'ocean',   label: 'Ocean',         emoji: '🌊', color: '#007AFF', description: 'Rhythmic waves', make: makeOcean },
  { id: 'forest',  label: 'Forest',        emoji: '🌿', color: '#34C759', description: 'Birds & breeze', make: makeForest },
  { id: 'bells',   label: 'Tibetan Bells', emoji: '🔔', color: '#AF52DE', description: 'Meditative tones', make: makeBells },
  { id: 'fire',    label: 'Fireplace',     emoji: '🔥', color: '#FF9500', description: 'Crackling fire', make: makeFire },
  { id: 'noise',   label: 'White Noise',   emoji: '☁️', color: '#8E8E93', description: 'Focus & sleep', make: makeWhiteNoise },
  { id: 'stream',  label: 'Stream',        emoji: '💧', color: '#30D158', description: 'Babbling brook', make: makeStream },
];

const BREATH_PHASES = ['Breathe in', 'Hold', 'Breathe out', 'Hold'];
const BREATH_DURATION = [4, 4, 6, 2]; // 4-4-6-2 box breathing variant

export default function SoundSanctuary() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.7);
  const [breathPhase, setBreathPhase] = useState(0);
  const [breathActive, setBreathActive] = useState(false);
  const [breathProgress, setBreathProgress] = useState(0);
  const ctxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const stopCurrentRef = useRef<(() => void) | null>(null);
  const breathTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getCtx = () => {
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const master = ctx.createGain();
      master.gain.setValueAtTime(volume, ctx.currentTime);
      master.connect(ctx.destination);
      ctxRef.current = ctx;
      masterGainRef.current = master;
    }
    return ctxRef.current;
  };

  const playSound = (sound: Sound) => {
    if (stopCurrentRef.current) {
      stopCurrentRef.current();
      stopCurrentRef.current = null;
    }
    if (activeId === sound.id) {
      setActiveId(null);
      return;
    }
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume();
    stopCurrentRef.current = sound.make(ctx);
    setActiveId(sound.id);
  };

  useEffect(() => {
    if (masterGainRef.current && ctxRef.current) {
      masterGainRef.current.gain.setValueAtTime(volume, ctxRef.current.currentTime);
    }
  }, [volume]);

  useEffect(() => {
    if (!breathActive) {
      if (breathTimerRef.current) clearInterval(breathTimerRef.current);
      setBreathPhase(0);
      setBreathProgress(0);
      return;
    }
    let phase = 0;
    let elapsed = 0;
    const TICK_MS = 50;

    breathTimerRef.current = setInterval(() => {
      elapsed += TICK_MS / 1000;
      const duration = BREATH_DURATION[phase];
      setBreathProgress(elapsed / duration);
      if (elapsed >= duration) {
        elapsed = 0;
        phase = (phase + 1) % BREATH_PHASES.length;
        setBreathPhase(phase);
      }
    }, TICK_MS);

    return () => { if (breathTimerRef.current) clearInterval(breathTimerRef.current); };
  }, [breathActive]);

  useEffect(() => {
    return () => {
      if (stopCurrentRef.current) stopCurrentRef.current();
      if (ctxRef.current && ctxRef.current.state !== 'closed') {
        ctxRef.current.close();
      }
    };
  }, []);

  const activeSoundObj = SOUNDS.find(s => s.id === activeId);
  const breathScale = breathPhase === 0
    ? 0.7 + breathProgress * 0.3
    : breathPhase === 1
      ? 1.0
      : breathPhase === 2
        ? 1.0 - breathProgress * 0.3
        : 0.7;

  return (
    <div className="sanctuary studio-scroll">
      <div className="sanctuary__header">
        <h1 className="sanctuary__title">Sound Sanctuary</h1>
        <p className="sanctuary__subtitle">Choose a soundscape to help you relax</p>
      </div>

      {activeId && activeSoundObj && (
        <div className="sanctuary__now-playing" style={{ borderColor: activeSoundObj.color }}>
          <span className="sanctuary__now-playing__emoji">{activeSoundObj.emoji}</span>
          <div>
            <p className="sanctuary__now-playing__label">Now playing</p>
            <p className="sanctuary__now-playing__name" style={{ color: activeSoundObj.color }}>{activeSoundObj.label}</p>
          </div>
          <div className="sanctuary__pulse" style={{ background: activeSoundObj.color }} />
        </div>
      )}

      <div className="sanctuary__grid">
        {SOUNDS.map((s) => {
          const isActive = activeId === s.id;
          return (
            <button
              key={s.id}
              type="button"
              className={`sanctuary__tile tap-feedback ${isActive ? 'sanctuary__tile--active' : ''}`}
              style={isActive ? { '--s-color': s.color, borderColor: s.color } as React.CSSProperties : { '--s-color': s.color } as React.CSSProperties}
              onClick={() => playSound(s)}
              aria-pressed={isActive}
              aria-label={`${isActive ? 'Stop' : 'Play'} ${s.label}`}
            >
              <span className="sanctuary__tile__emoji">{s.emoji}</span>
              <span className="sanctuary__tile__label">{s.label}</span>
              <span className="sanctuary__tile__desc">{s.description}</span>
              {isActive && <span className="sanctuary__tile__stop">■ Stop</span>}
            </button>
          );
        })}
      </div>

      <div className="sanctuary__volume">
        <label className="sanctuary__volume__label" htmlFor="vol-slider">Volume</label>
        <input
          id="vol-slider"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={e => setVolume(Number(e.target.value))}
          className="sanctuary__volume__slider"
          aria-label="Volume"
        />
        <span className="sanctuary__volume__val">{Math.round(volume * 100)}%</span>
      </div>

      <div className="sanctuary__breath-section">
        <div className="sanctuary__breath-header">
          <p className="sanctuary__breath-title">Breathing Exercise</p>
          <button
            type="button"
            className={`sanctuary__breath-toggle tap-feedback ${breathActive ? 'sanctuary__breath-toggle--active' : ''}`}
            onClick={() => setBreathActive(v => !v)}
          >
            {breathActive ? 'Stop' : 'Start'}
          </button>
        </div>
        <p className="sanctuary__breath-hint">4-4-6-2 box breathing — inhale, hold, exhale, hold</p>

        <div className="sanctuary__breath-visual">
          <div
            className={`sanctuary__breath-orb ${breathActive ? 'sanctuary__breath-orb--active' : ''}`}
            style={{ transform: breathActive ? `scale(${breathScale})` : 'scale(0.7)' }}
          />
          {breathActive && (
            <div className="sanctuary__breath-text">
              <p className="sanctuary__breath-phase">{BREATH_PHASES[breathPhase]}</p>
              <p className="sanctuary__breath-count">{BREATH_DURATION[breathPhase]}s</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
