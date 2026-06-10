import { useState } from 'react';
import { GOLDEN_PATH_STEPS, executeGoldenPathAction } from '../lib/goldenPath';
import ForgetMeNotMark from './ForgetMeNotMark';
import StudioIcon from './StudioIcon';

interface Props {
  onNavigate: (tab: 'home' | 'voice') => void;
  onClose: () => void;
}

export default function GoldenPathDemo({ onNavigate, onClose }: Props) {
  const [stepIdx, setStepIdx] = useState(0);
  const [running, setRunning] = useState(false);

  const step = GOLDEN_PATH_STEPS[stepIdx];

  const runFrom = async (from: number) => {
    setRunning(true);
    for (let i = from; i < GOLDEN_PATH_STEPS.length; i++) {
      setStepIdx(i);
      const s = GOLDEN_PATH_STEPS[i];
      await executeGoldenPathAction(s.id, onNavigate);
      await new Promise((r) => setTimeout(r, s.durationMs));
    }
    setRunning(false);
  };

  const start = () => {
    setStepIdx(0);
    void runFrom(0);
  };

  return (
    <div className="golden-path" role="dialog" aria-label="Judge demo mode">
      <div className="golden-path__card card">
        <div className="golden-path__header">
          <ForgetMeNotMark size={28} />
          <div>
            <p className="golden-path__eyebrow">Judge Demo — 90 seconds</p>
            <h2 className="golden-path__title">{step?.title ?? 'Recall Golden Path'}</h2>
          </div>
          <button type="button" className="studio-icon-btn tap-feedback" onClick={onClose} aria-label="Close">
            <StudioIcon name="close" size={18} />
          </button>
        </div>

        <p className="golden-path__caption">{step?.caption}</p>

        <div className="golden-path__progress">
          {GOLDEN_PATH_STEPS.map((s, i) => (
            <span
              key={s.id}
              className={`golden-path__dot ${i <= stepIdx ? 'golden-path__dot--done' : ''} ${i === stepIdx ? 'golden-path__dot--current' : ''}`}
            />
          ))}
        </div>

        <div className="golden-path__actions">
          <button type="button" className="studio-btn studio-btn--primary tap-feedback" onClick={start} disabled={running}>
            {running ? 'Demo running…' : 'Run full demo'}
          </button>
          <button type="button" className="studio-btn studio-btn--ghost tap-feedback" onClick={onClose}>
            Exit demo mode
          </button>
        </div>
      </div>
    </div>
  );
}
