import { useState, useEffect, useRef } from 'react';

type Phase = 'in' | 'hold' | 'out' | 'pause';

interface Props { cycles?: number; onComplete?: () => void; }

const LABELS: Record<Phase, string> = { in: 'Breathe in...', hold: 'Hold...', out: 'Breathe out...', pause: 'Rest...' };

export default function BreathingCircle({ cycles = 3, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('in');
  const [cycle, setCycle] = useState(0);
  const [scale, setScale] = useState(1);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const seq: { p: Phase; dur: number; sc: number }[] = [
      { p: 'in',   dur: 4000, sc: 1.38 },
      { p: 'hold', dur: 4000, sc: 1.38 },
      { p: 'out',  dur: 4000, sc: 1.0  },
      { p: 'pause',dur: 500,  sc: 1.0  },
    ];
    let idx = 0, cycleCount = 0;

    const step = () => {
      const { p, dur, sc } = seq[idx];
      setPhase(p); setScale(sc);
      timer.current = setTimeout(() => {
        idx++;
        if (idx >= seq.length) { idx = 0; cycleCount++; setCycle(cycleCount); }
        if (cycleCount >= cycles) { onComplete?.(); return; }
        step();
      }, dur);
    };
    step();
    return () => clearTimeout(timer.current);
  }, [cycles, onComplete]);

  const size = 200;
  const center = size / 2;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
      <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Concentric rings */}
        {[size, size * 0.75, size * 0.5].map((s, i) => (
          <div key={i} style={{
            position: 'absolute',
            width: s, height: s,
            borderRadius: '50%',
            border: '2.5px solid rgba(14,122,230,0.32)',
            background: 'rgba(14,122,230,0.04)',
            transform: `scale(${scale})`,
            transition: `transform ${phase === 'in' ? 4000 : phase === 'out' ? 4000 : 50}ms ${phase === 'in' ? 'ease-in' : 'ease-out'}`,
            transitionDelay: `${i * 80}ms`,
          }} />
        ))}
        {/* Center icon */}
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: 'white',
          boxShadow: '0 4px 24px rgba(14,122,230,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2,
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="1.8" strokeLinecap="round">
            <path d="M9.59 4.59A2 2 0 1111 8H2m10.59 11.41A2 2 0 1013 16H2m15.73-8.27A2.5 2.5 0 1119.5 12H2"/>
          </svg>
        </div>
      </div>
      <div style={{
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontSize: 20, fontWeight: 700, color: 'var(--blue)',
        transition: 'opacity 500ms',
      }}>
        {LABELS[phase]}
      </div>
      <div className="t-caption">Cycle {cycle + 1} of {cycles}</div>
    </div>
  );
}
