import { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import StudioIcon, { type IconName } from './StudioIcon';

const STEPS: { icon: IconName; label: string; detail: string }[] = [
  { icon: 'chat', label: 'Signal', detail: 'Repeated question detected' },
  { icon: 'score', label: 'ACSE', detail: 'Score dropped below threshold' },
  { icon: 'heart', label: 'Comfort', detail: 'Grounding mode activated' },
  { icon: 'alert', label: 'Alert', detail: 'Caregiver notified instantly' },
];

export default function RecallCascade() {
  const { comfortModeActive, acseScore } = useAppStore();
  const [activeStep, setActiveStep] = useState(-1);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (comfortModeActive && acseScore < 50) {
      setShow(true);
      setActiveStep(0);
      const timers = STEPS.map((_, i) =>
        window.setTimeout(() => setActiveStep(i), i * 700)
      );
      return () => timers.forEach(clearTimeout);
    }
    if (!comfortModeActive) {
      const t = window.setTimeout(() => {
        setShow(false);
        setActiveStep(-1);
      }, 800);
      return () => clearTimeout(t);
    }
  }, [comfortModeActive, acseScore]);

  if (!show) return null;

  return (
    <div className="recall-cascade" role="status" aria-live="polite">
      <p className="recall-cascade__eyebrow">Recall Cascade™</p>
      <div className="recall-cascade__track">
        {STEPS.map((step, i) => (
          <div
            key={step.label}
            className={`recall-cascade__step ${i <= activeStep ? 'recall-cascade__step--lit' : ''}`}
          >
            <span className="recall-cascade__icon">
              <StudioIcon name={step.icon} size={20} />
            </span>
            <span className="recall-cascade__label">{step.label}</span>
            {i <= activeStep && (
              <span className="recall-cascade__detail">{step.detail}</span>
            )}
            {i < STEPS.length - 1 && (
              <span className={`recall-cascade__connector ${i < activeStep ? 'recall-cascade__connector--lit' : ''}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
