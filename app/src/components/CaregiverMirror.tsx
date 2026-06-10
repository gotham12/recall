import { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { sendPresencePulse } from '../lib/presence';
import { publishSync } from '../lib/syncBridge';
import StudioIcon from './StudioIcon';

/**
 * Live split-screen: what Susan sees on her phone while Margaret is in Comfort Mode.
 * The hackathon "wow" — two perspectives, one device.
 */
export default function CaregiverMirror() {
  const { user, acseScore, comfortModeActive, supervisorAlerts } = useAppStore();
  const [pulseSent, setPulseSent] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (comfortModeActive || acseScore < 60) {
      setVisible(true);
    }
  }, [comfortModeActive, acseScore]);

  if (!user?.id || !visible) return null;

  const firstName = user.name.split(' ')[0];
  const latestAlert = supervisorAlerts[0];

  const handleWarmth = () => {
    sendPresencePulse(user.id!, user.caregiverName);
    publishSync(user.id!, { type: 'presence', caregiverName: user.caregiverName, at: Date.now() });
    publishSync(user.id!, { type: 'warmth_ack', at: Date.now() });
    setPulseSent(true);
    setTimeout(() => setPulseSent(false), 3000);
  };

  return (
    <div className={`caregiver-mirror ${comfortModeActive ? 'caregiver-mirror--active' : ''}`}>
      <div className="caregiver-mirror__phone">
        <div className="caregiver-mirror__notch" />
        <div className="caregiver-mirror__screen">
          <p className="caregiver-mirror__eyebrow">Susan&apos;s phone</p>
          <p className="caregiver-mirror__headline">
            {comfortModeActive ? `${firstName} needs you` : `Monitoring ${firstName}`}
          </p>

          {latestAlert && (
            <div className="caregiver-mirror__alert">
              <StudioIcon name="alert" size={16} />
              <span>{latestAlert.message}</span>
            </div>
          )}

          <div className="caregiver-mirror__stats">
            <div className="caregiver-mirror__stat">
              <span className="caregiver-mirror__stat-val">{acseScore}</span>
              <span className="caregiver-mirror__stat-lbl">ACSE</span>
            </div>
            <div className="caregiver-mirror__stat caregiver-mirror__stat--warn">
              <span className="caregiver-mirror__stat-val">
                {acseScore < 50 ? 'High' : acseScore < 75 ? 'Med' : 'Low'}
              </span>
              <span className="caregiver-mirror__stat-lbl">Risk</span>
            </div>
          </div>

          <button
            type="button"
            className="caregiver-mirror__warmth tap-feedback"
            onClick={handleWarmth}
          >
            <StudioIcon name="heart" size={18} />
            {pulseSent ? 'Sent ✓' : 'Send Warmth'}
          </button>
        </div>
      </div>
      <button
        type="button"
        className="caregiver-mirror__dismiss tap-feedback"
        onClick={() => setVisible(false)}
        aria-label="Hide caregiver preview"
      >
        <StudioIcon name="close" size={14} />
      </button>
    </div>
  );
}
