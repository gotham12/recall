import { useEffect, useState } from 'react';
import StudioIcon from './StudioIcon';

type Phase = 'in' | 'hold' | 'out' | 'done';

interface BreathingCircleProps {
  onComplete?: () => void;
  cycles?: number;
}

export default function BreathingCircle({ onComplete, cycles = 3 }: BreathingCircleProps) {
  const [phase, setPhase] = useState<Phase>('in');
  const [cycleCount, setCycleCount] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(4);
  const [label, setLabel] = useState('Breathe In…');

  useEffect(() => {
    const sequence: { phase: Phase; duration: number; label: string }[] = [
      { phase: 'in', duration: 4, label: 'Breathe In…' },
      { phase: 'hold', duration: 4, label: 'Hold…' },
      { phase: 'out', duration: 4, label: 'Breathe Out…' },
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
    phase === 'in' ? 'breathing-in' :
    phase === 'hold' ? 'breathing-hold' :
    phase === 'out' ? 'breathing-out' :
    '';

  const circleColor =
    phase === 'in' ? 'rgba(255,255,255,0.18)' :
    phase === 'hold' ? 'rgba(255,255,255,0.12)' :
    phase === 'out' ? 'rgba(255,255,255,0.08)' :
    'rgba(16,185,129,0.2)';

  const borderColor = phase === 'done' ? '#10B981' : 'rgba(255,255,255,0.45)';
  const textColor = phase === 'done' ? '#10B981' : '#ffffff';

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
