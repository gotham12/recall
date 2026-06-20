import { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';

export default function LoadingScreen() {
  const setScreen = useAppStore(s => s.setScreen);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const exitTimer = setTimeout(() => setExiting(true), 2200);
    const doneTimer = setTimeout(() => setScreen('login'), 2750);
    return () => { clearTimeout(exitTimer); clearTimeout(doneTimer); };
  }, [setScreen]);

  return (
    <div
      className="sl-splash-root"
      style={{ opacity: exiting ? 0 : 1, transition: 'opacity 0.55s ease' }}
      aria-label="Loading Recall"
    >
      <div className="sl-splash-flower-wrap" aria-hidden>
        <div className="sl-splash-ring" />
        <img src="/logo.png" alt="" className="sl-splash-logo" />
      </div>

      <p className="sl-splash-title" style={{ animationDelay: '0.3s' }}>
        Recall
      </p>
      <p className="sl-splash-sub" style={{ animationDelay: '0.6s' }}>
        Memory · Medication · Moments
      </p>
    </div>
  );
}
