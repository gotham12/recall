import { useEffect, useState } from 'react';

type Phase = 'in' | 'hold' | 'out' | 'done';

interface BreathingCircleProps {
  onComplete?: () => void;
  cycles?: number;
}

export default function BreathingCircle({ onComplete, cycles = 3 }: BreathingCircleProps) {
  const [phase, setPhase] = useState<Phase>('in');
  const [cycleCount, setCycleCount] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(4);
  const [label, setLabel] = useState('Breathe In...');

  useEffect(() => {
    const sequence: { phase: Phase; duration: number; label: string }[] = [
      { phase: 'in',   duration: 4, label: 'Breathe In...' },
      { phase: 'hold', duration: 4, label: 'Hold...' },
      { phase: 'out',  duration: 4, label: 'Breathe Out...' },
    ];

    let seqIdx = 0;
    let secsLeft = sequence[0].duration;
    let currentCycle = 0;

    setPhase(sequence[0].phase);
    setLabel(sequence[0].label);
    setSecondsLeft(secsLeft);

    const interval = setInterval(() => {
      secsLeft--;
      setSecondsLeft(secsLeft);

      if (secsLeft <= 0) {
        seqIdx++;
        if (seqIdx >= sequence.length) {
          seqIdx = 0;
          currentCycle++;
          if (currentCycle >= cycles) {
            clearInterval(interval);
            setPhase('done');
            setLabel('Well done 🌟');
            onComplete?.();
            return;
          }
          setCycleCount(currentCycle);
        }
        secsLeft = sequence[seqIdx].duration;
        setSecondsLeft(secsLeft);
        setPhase(sequence[seqIdx].phase);
        setLabel(sequence[seqIdx].label);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [cycles, onComplete]);

  const circleClass =
    phase === 'in'   ? 'breathing-in' :
    phase === 'hold' ? 'breathing-hold' :
    phase === 'out'  ? 'breathing-out' :
    '';

  const circleColor =
    phase === 'in'   ? 'rgba(33,150,243,0.25)' :
    phase === 'hold' ? 'rgba(33,150,243,0.18)' :
    phase === 'out'  ? 'rgba(0,87,204,0.15)' :
    'rgba(16,185,129,0.2)';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 0',
        gap: 20,
      }}
    >
      {/* Outer glow ring */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          className={circleClass}
          style={{
            width: 180,
            height: 180,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${circleColor} 0%, transparent 70%)`,
            border: `3px solid ${phase === 'done' ? '#10B981' : '#2196F3'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'border-color 0.5s ease',
          }}
        >
          <div
            style={{
              fontSize: phase === 'done' ? 48 : 36,
              fontWeight: 700,
              color: phase === 'done' ? '#10B981' : '#2196F3',
            }}
          >
            {phase === 'done' ? '✓' : secondsLeft}
          </div>
        </div>
      </div>

      <p style={{ fontSize: 26, color: '#1A2B4A', fontWeight: 500, margin: 0 }}>
        {label}
      </p>

      {phase !== 'done' && (
        <p style={{ fontSize: 18, color: '#8A9AB0', margin: 0 }}>
          Cycle {cycleCount + 1} of {cycles}
        </p>
      )}
    </div>
  );
}
