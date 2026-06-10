import { useAppStore } from '../../store/appStore';
import { ACSE_SIGNALS, type AcseSignalId } from '../../lib/acseEngine';
import StudioIcon from '../StudioIcon';

const SIGNAL_ICONS: Partial<Record<AcseSignalId, 'clara' | 'warning' | 'meds' | 'heart' | 'score'>> = {
  perseveration: 'clara',
  semantic_loop: 'clara',
  sundowning: 'warning',
  disorientation_speech: 'warning',
  rapid_navigation: 'score',
  inactivity: 'score',
  medication_confusion: 'meds',
  missed_medication: 'meds',
  recovery: 'heart',
  caregiver_warmth: 'heart',
};

export default function ACSESignalAudit() {
  const { acseSignalLog } = useAppStore();

  return (
    <section className="signal-audit card">
      <div className="signal-audit__header">
        <StudioIcon name="score" size={22} />
        <div>
          <h3 className="studio-section-title" style={{ margin: 0 }}>ACSE Signal Audit™</h3>
          <p className="studio-text-muted" style={{ margin: 0, fontSize: 14 }}>
            Behavioral signals mapped to neurological domains — for caregiver transparency, not diagnosis.
          </p>
        </div>
      </div>

      {acseSignalLog.length === 0 ? (
        <p className="studio-text-muted">No signals recorded this session. Interact on the patient device to see live audit trail.</p>
      ) : (
        <ul className="signal-audit__list">
          {acseSignalLog.slice(0, 12).map((evt) => {
            const meta = evt.signalId !== 'manual' ? ACSE_SIGNALS[evt.signalId as AcseSignalId] : null;
            const icon = meta ? SIGNAL_ICONS[meta.id] ?? 'score' : 'score';
            return (
              <li key={evt.id} className="signal-audit__item">
                <span className={`signal-audit__delta ${evt.points > 0 ? 'signal-audit__delta--up' : 'signal-audit__delta--down'}`}>
                  {evt.points > 0 ? '+' : ''}{evt.points}
                </span>
                <div className="signal-audit__body">
                  <p className="signal-audit__reason">
                    <StudioIcon name={icon} size={16} />
                    {evt.reason}
                  </p>
                  {meta && (
                    <p className="signal-audit__neuro">
                      <strong>{meta.neurology}</strong> — {meta.clinicalBasis}
                    </p>
                  )}
                  {evt.neurology && !meta && (
                    <p className="signal-audit__neuro">{evt.neurology}</p>
                  )}
                  <p className="signal-audit__meta">
                    Score after: {evt.scoreAfter} · {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <details className="signal-audit__catalog">
        <summary>Full signal catalog (for judges & clinicians)</summary>
        <ul className="signal-audit__catalog-list">
          {Object.values(ACSE_SIGNALS).map((s) => (
            <li key={s.id}>
              <strong>{s.label}</strong> — <em>{s.neurology}</em>
              <p>{s.clinicalBasis}</p>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
