import { useEffect, useRef, useState } from 'react';
import StudioIcon from './StudioIcon';
import { useAppStore } from '../store/appStore';

type Phase = 'in' | 'hold' | 'out' | 'rest' | 'done';

interface BreathingCircleProps {
  onComplete?: () => void;
  cycles?: number;
}

export default function BreathingCircle({ onComplete, cycles = 3 }: BreathingCircleProps) {
  const theme = useAppStore((s) => s.theme);
  const isLight = theme === 'light';
  const [phase, setPhase] = useState<Phase>('in');
  const [cycleCount, setCycleCount] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(3);
  const [label, setLabel] = useState('Breathe In…');

  // Keep a stable ref so the interval never needs onComplete in its deps.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    const sequence: { phase: Phase; duration: number; label: string }[] = [
      { phase: 'in',   duration: 3, label: 'Breathe In…' },
      { phase: 'hold', duration: 4, label: 'Hold…' },
      { phase: 'out',  duration: 3, label: 'Breathe Out…' },
      { phase: 'rest', duration: 4, label: 'Rest…' },
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
            setLabel('Well done');
            onCompleteRef.current?.();
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
  }, [cycles]); // onComplete intentionally omitted — read via ref above

  const circleClass =
    phase === 'in'   ? 'breathing-in' :
    phase === 'hold' ? 'breathing-hold' :
    phase === 'out'  ? 'breathing-out' :
    phase === 'rest' ? 'breathing-out' :
    '';

  const circleColor =
    phase === 'in'   ? (isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.18)') :
    phase === 'hold' ? (isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.12)') :
    phase === 'out'  ? (isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.08)') :
    phase === 'rest' ? (isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.05)') :
    'rgba(16,185,129,0.2)';

  const borderColor = phase === 'done' ? '#10B981' : (isLight ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.45)');
  const textColor = phase === 'done' ? '#10B981' : undefined;

  return (
    <div className="breathing-circle">
      <div className="breathing-circle__ring-wrap">
        <div
          className={`breathing-circle__ring ${circleClass}`}
          style={{
            background: `radial-gradient(circle, ${circleColor} 0%, transparent 70%)`,
            borderColor,
          }}
        >
          <div className="breathing-circle__counter" style={{ color: textColor }}>
            {phase === 'done' ? (
              <StudioIcon name="success" size={40} />
            ) : (
              secondsLeft
            )}
          </div>
        </div>
      </div>

      <p className="breathing-circle__label">{label}</p>

      {phase !== 'done' && (
        <p className="breathing-circle__cycle">
          Cycle {cycleCount + 1} of {cycles}
        </p>
      )}
    </div>
  );
}
