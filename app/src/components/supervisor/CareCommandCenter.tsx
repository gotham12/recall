import { useLiveQuery } from 'dexie-react-hooks';
import { useAppStore } from '../../store/appStore';
import { db, type SupervisorAlertRecord } from '../../db/db';
import { loadCareSettings } from '../../lib/careSettings';
import { isSundowningWindow } from '../../lib/acseEngine';
import { sendPresencePulse } from '../../lib/presence';
import { publishSync } from '../../lib/syncBridge';
import StudioIcon from '../StudioIcon';

export default function CareCommandCenter() {
  const { user, acseScore, comfortModeActive, addSupervisorAlert, warmthReceived } = useAppStore();
  const settings = loadCareSettings(user?.id);

  const recentAlerts = useLiveQuery<SupervisorAlertRecord[]>(
    () =>
      user?.id
        ? db.supervisorAlerts
            .where('userId')
            .equals(user.id)
            .and((a) => !a.dismissed)
            .reverse()
            .limit(5)
            .toArray()
        : [],
    [user?.id]
  ) ?? [];

  const journalToday = useLiveQuery(
    () => {
      if (!user?.id) return Promise.resolve(0);
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return db.careJournal
        .where('userId')
        .equals(user.id)
        .and((j) => new Date(j.timestamp) >= start)
        .count();
    },
    [user?.id]
  ) ?? 0;

  const medsToday = useLiveQuery(
    () => {
      if (!user?.id) return Promise.resolve(0);
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return db.medicationLogs
        .where('userId')
        .equals(user.id)
        .and((l) => new Date(l.timestamp) >= start)
        .count();
    },
    [user?.id]
  ) ?? 0;

  const statusColor =
    acseScore >= 75 ? '#10B981' : acseScore >= settings.comfortThreshold ? '#F59E0B' : '#EF4444';

  const statusLabel =
    comfortModeActive
      ? 'Comfort Mode active'
      : acseScore >= 75
        ? 'Stable'
        : acseScore >= settings.comfortThreshold
          ? 'Monitor closely'
          : 'Needs immediate support';

  const triggerRemoteComfort = () => {
    if (!user?.id) return;
    publishSync(user.id, { type: 'comfort', active: true, at: Date.now() });
    addSupervisorAlert({
      message: `Remote Comfort Mode signal sent to ${user.name.split(' ')[0]}`,
      timestamp: new Date().toISOString(),
      type: 'comfort_mode',
      persist: false,
    });
  };

  return (
    <section className="care-command card">
      <div className="care-command__header">
        <p className="care-command__eyebrow">Care Command Center™</p>
        <p className="care-command__patient">{settings.patientDisplayName || user?.name}</p>
      </div>

      <div className="care-command__status" style={{ borderColor: statusColor }}>
        <div className="care-command__score" style={{ color: statusColor }}>
          {acseScore}
          <span>ACSE</span>
        </div>
        <div>
          <p className="care-command__status-label">{statusLabel}</p>
          <p className="studio-text-muted" style={{ margin: 0, fontSize: 14 }}>
            Threshold: {settings.comfortThreshold} · Alert below {settings.alertOnScoreBelow}
          </p>
        </div>
      </div>

      <div className="care-command__flags">
        {isSundowningWindow() && (
          <span className="care-command__flag care-command__flag--warn">
            <StudioIcon name="warning" size={14} /> Sundowning window (4–8 PM)
          </span>
        )}
        {comfortModeActive && (
          <span className="care-command__flag care-command__flag--alert">
            <StudioIcon name="heart" size={14} /> Comfort Mode on patient device
          </span>
        )}
        {warmthReceived && (
          <span className="care-command__flag care-command__flag--ok">
            <StudioIcon name="heart" size={14} /> Warmth acknowledged
          </span>
        )}
      </div>

      <div className="care-command__metrics">
        <div><strong>{medsToday}</strong><span>Meds today</span></div>
        <div><strong>{journalToday}</strong><span>Journal entries</span></div>
        <div><strong>{recentAlerts.length}</strong><span>Open alerts</span></div>
      </div>

      <div className="care-command__actions">
        <button
          type="button"
          className="btn-warmth tap-feedback"
          onClick={() => user?.id && sendPresencePulse(user.id, user.caregiverName)}
        >
          <StudioIcon name="heart" size={18} /> Send Warmth
        </button>
        <button type="button" className="studio-btn tap-feedback" onClick={triggerRemoteComfort}>
          <StudioIcon name="shield" size={18} /> Remote Comfort
        </button>
      </div>
    </section>
  );
}
