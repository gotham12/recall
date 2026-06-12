import { useRef, useState, type CSSProperties } from 'react';
import { useAppStore } from '../store/appStore';
import { triggerSOS, shareLocation, buildEmergencySms, dialNumber, dial911 } from '../lib/emergency';
import { db } from '../db/db';
import StudioIcon from './StudioIcon';

const HOLD_MS = 1500;

interface Props { inline?: boolean; }

export default function EmergencySOS({ inline = false }: Props) {
  const { user } = useAppStore();
  const [active, setActive] = useState(false);
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTime = useRef(0);

  if (!user) return null;

  const clearHold = () => {
    if (holdTimer.current) clearInterval(holdTimer.current);
    holdTimer.current = null;
    setHolding(false);
    setProgress(0);
  };

  const startHold = () => {
    setHolding(true);
    startTime.current = Date.now();
    holdTimer.current = setInterval(() => {
      const elapsed = Date.now() - startTime.current;
      const pct = Math.min(100, (elapsed / HOLD_MS) * 100);
      setProgress(pct);
      if (elapsed >= HOLD_MS) {
        clearHold();
        void activateSOS();
      }
    }, 50);
  };

  const activateSOS = async () => {
    setActive(true);
    await triggerSOS(user);
    const contacts = user.id
      ? await db.emergencyContacts.where('userId').equals(user.id).toArray()
      : [];
    const location = await shareLocation(user);
    const sms = buildEmergencySms(user, contacts, location);
    if (user.caregiverPhone) {
      window.location.href = `sms:${user.caregiverPhone}?body=${encodeURIComponent(sms)}`;
    }
  };

  return (
    <>
      <button
        type="button"
        className={inline ? `sos-inline tap-feedback ${holding ? 'sos-inline--holding' : ''}` : `sos-fab tap-feedback ${holding ? 'sos-fab--holding' : ''}`}
        aria-label="Emergency SOS — hold to activate"
        onPointerDown={startHold}
        onPointerUp={clearHold}
        onPointerLeave={clearHold}
        onPointerCancel={clearHold}
        style={inline ? { '--progress': `${progress}%` } as CSSProperties : undefined}
      >
        {!inline && <span className="sos-fab__ring" style={{ '--progress': `${progress}%` } as CSSProperties} />}
        <StudioIcon name="sos" size={inline ? 18 : 26} />
        <span className={inline ? 'sos-inline__label' : 'sos-fab__label'}>SOS</span>
      </button>

      {active && (
        <div className="sos-modal" role="dialog" aria-modal="true">
          <div className="sos-modal__card card">
            <StudioIcon name="alert" size={36} />
            <h2 className="sos-modal__title">Help is on the way</h2>
            <p className="sos-modal__text">
              Your caregiver has been notified. Stay where you are — you are safe.
            </p>
            <div className="sos-modal__actions">
              {user.caregiverPhone && (
                <button type="button" className="studio-btn studio-btn--primary tap-feedback" onClick={() => dialNumber(user.caregiverPhone!)}>
                  Call {user.caregiverName}
                </button>
              )}
              <button type="button" className="studio-btn studio-btn--ghost tap-feedback" onClick={dial911}>Call 911</button>
              <button type="button" className="studio-btn studio-btn--text tap-feedback" onClick={() => setActive(false)}>I'm okay now</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
