import { useEffect, useRef, useState } from 'react';
import { subscribePresence, type PresencePulse as Pulse } from '../lib/presence';
import { useAppStore } from '../store/appStore';
import StudioIcon from './StudioIcon';

/** Patient-side: shows when caregiver sends warmth across tabs/devices */
export default function PresencePulseBanner() {
  const user = useAppStore((s) => s.user);
  const warmthReceived = useAppStore((s) => s.warmthReceived);
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const lastPulseAt = useRef(0);

  const recoverAcse = useAppStore((s) => s.recoverAcse);

  useEffect(() => {
    if (!user?.id) return;
    return subscribePresence(user.id, (p) => {
      setPulse(p);
      // Only count each distinct warmth pulse once (the poll re-emits the same pulse).
      if (p.at !== lastPulseAt.current) {
        lastPulseAt.current = p.at;
        recoverAcse(5, 'Caregiver warmth received — social co-regulation');
      }
    });
  }, [user?.id, recoverAcse]);

  useEffect(() => {
    if (!pulse) return;
    const remaining = 90_000 - (Date.now() - pulse.at);
    if (remaining <= 0) {
      setPulse(null);
      return;
    }
    const t = window.setTimeout(() => setPulse(null), remaining);
    return () => window.clearTimeout(t);
  }, [pulse]);

  const name = pulse?.caregiverName ?? user?.caregiverName;
  if (!pulse && !warmthReceived) return null;

  return (
    <div className="presence-pulse presence-pulse--glow" role="status" aria-live="polite">
      <div className="presence-pulse__ring" aria-hidden />
      <div className="presence-pulse__ring presence-pulse__ring--2" aria-hidden />
      <StudioIcon name="heart" size={20} />
      <span>
        <strong>{name}</strong> is thinking of you right now
      </span>
    </div>
  );
}
