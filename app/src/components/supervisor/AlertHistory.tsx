import { useLiveQuery } from 'dexie-react-hooks';
import { db, type SupervisorAlertRecord } from '../../db/db';
import { useAppStore } from '../../store/appStore';
import StudioIcon from '../StudioIcon';

const TYPE_LABELS: Record<string, string> = {
  comfort_mode: 'Comfort Mode',
  medication_unconfirmed: 'Med unverified',
  sos: 'SOS',
  presence: 'Presence',
  general: 'General',
};

export default function AlertHistory() {
  const { user, clearSupervisorAlert, supervisorAlerts } = useAppStore();

  const history = useLiveQuery<SupervisorAlertRecord[]>(
    () =>
      user?.id
        ? db.supervisorAlerts.where('userId').equals(user.id).reverse().limit(20).toArray()
        : [],
    [user?.id]
  ) ?? [];

  const all = [
    ...supervisorAlerts.map((a) => ({ ...a, live: true })),
    ...history.filter((h) => !supervisorAlerts.some((s) => s.message === h.message)),
  ].slice(0, 15);

  return (
    <section className="alert-history card">
      <h3 className="studio-section-title">Alert History</h3>
      {all.length === 0 ? (
        <p className="studio-text-muted">No alerts recorded.</p>
      ) : (
        <ul className="alert-history__list">
          {all.map((a, i) => (
            <li key={a.id ?? i} className={`alert-history__item ${'dismissed' in a && a.dismissed ? 'alert-history__item--dismissed' : ''}`}>
              <StudioIcon name={a.type === 'sos' ? 'warning' : 'alert'} size={18} />
              <div>
                <p className="alert-history__type">{TYPE_LABELS[a.type] ?? a.type}</p>
                <p className="alert-history__msg">{a.message}</p>
                <time>{new Date(a.timestamp).toLocaleString()}</time>
              </div>
              {'live' in a && a.live && a.id && (
                <button type="button" className="studio-icon-btn tap-feedback" onClick={() => clearSupervisorAlert(a.id!)}>
                  <StudioIcon name="close" size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
