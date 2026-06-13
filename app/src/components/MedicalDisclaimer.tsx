import { useState } from 'react';
import RecallLogo from './RecallLogo';

interface Props {
  onAccept: () => void;
}

export default function MedicalDisclaimer({ onAccept }: Props) {
  const [checked, setChecked] = useState(false);

  return (
    <div className="disclaimer-overlay" role="dialog" aria-modal="true" aria-labelledby="disclaimer-title">
      <div className="disclaimer-card card">
        <div className="disclaimer-card__brand">
          <RecallLogo size="md" />
        </div>
        <h1 id="disclaimer-title" className="disclaimer-card__title">Welcome to Recall</h1>
        <p className="disclaimer-card__lead">
          A gentle companion for daily memory care — built for families, not to replace your care team.
        </p>

        <div className="disclaimer-card__notes">
          <p>Not a medical device. Always confirm medications with your doctor.</p>
          <p>In an emergency, call <strong>911</strong>.</p>
        </div>

        <label className="disclaimer-card__check">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          <span>I understand Recall is a support tool only</span>
        </label>

        <button
          type="button"
          className="studio-btn studio-btn--primary tap-feedback disclaimer-card__cta"
          disabled={!checked}
          onClick={onAccept}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
