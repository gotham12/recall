import { useState, useRef, useCallback, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { useACSE } from '../hooks/useACSE';
import { verifyMedication } from '../services/vision';
import { speak } from '../services/elevenlabs';
import { db, type Medication } from '../db/db';

const COOLDOWN_H = 6;
const MAX_RETRY  = 3;

type Phase = 'list' | 'confirm' | 'camera' | 'verifying' | 'countdown' | 'confirmed' | 'rejected' | 'cooldown' | 'escalated';

export default function MedTracker() {
  const user   = useAppStore((s) => s.user);
  const addAlert = useAppStore((s) => s.addSupervisorAlert);
  const [med, setMed]         = useState<Medication | null>(null);
  const [phase, setPhase]     = useState<Phase>('list');
  const [retries, setRetries] = useState(0);
  const [countdown, setCd]    = useState(10);
  const [cooldownMsg, setCooldownMsg] = useState('');
  const [visionMsg, setVisionMsg]     = useState('');
  const [visionConf, setVisionConf]   = useState<'high'|'medium'|'low'>('high');
  const [cameraAvail, setCameraAvail] = useState(true);
  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream|null>(null);
  const { recordMedicationReAttempt } = useACSE();

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const checkCooldown = useCallback(async (medName: string) => {
    if (!user?.id) return false;
    const cutoff = new Date(Date.now() - COOLDOWN_H * 3600000).toISOString();
    const recent = await db.medicationLogs
      .where('userId').equals(user.id)
      .and(l => l.medicationName === medName && l.timestamp > cutoff && l.confirmed)
      .first();
    return !!recent;
  }, [user]);

  const logMed = useCallback(async (medication: Medication, conf: string, desc: string, img: string, escalated = false) => {
    if (!user?.id) return;
    await db.medicationLogs.add({
      userId: user.id, medicationName: medication.name,
      timestamp: new Date().toISOString(),
      visionConfidence: conf as 'high'|'medium'|'low'|'manual'|'unconfirmed',
      visionDescription: desc, imageThumbnail: img || undefined,
      confirmed: !escalated, escalated,
    });
    if (!escalated) {
      await db.events.add({
        userId: user.id, timestamp: new Date().toISOString(),
        type: 'user_action', title: `${medication.name} taken`,
        description: `${user.name} took ${medication.name} ${medication.dosage}. Confidence: ${conf}.`,
        completed: true, source: 'system',
      });
    }
  }, [user]);

  const selectMed = useCallback(async (medication: Medication) => {
    setMed(medication);
    const onCooldown = await checkCooldown(medication.name);
    if (onCooldown) {
      recordMedicationReAttempt();
      const log = await db.medicationLogs.where('userId').equals(user!.id!)
        .and(l => l.medicationName === medication.name).last();
      const mins = log ? Math.round((Date.now() - new Date(log.timestamp).getTime()) / 60000) : 0;
      const remaining = Math.max(0, COOLDOWN_H * 60 - mins);
      setCooldownMsg(`You already took ${medication.name} ${mins} minutes ago. Next dose in ${remaining} minutes.`);
      speak(`You already took ${medication.name} ${mins} minutes ago.`).catch(console.error);
      setPhase('cooldown');
      return;
    }
    speak(`Time to take your ${medication.name}. Are you ready?`).catch(console.error);
    setRetries(0);
    setPhase('confirm');
  }, [checkCooldown, recordMedicationReAttempt, user]);

  const openCamera = useCallback(async () => {
    setPhase('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraAvail(true);
    } catch {
      setCameraAvail(false);
      speak('Camera not available. Please confirm manually.').catch(console.error);
      // Fall back to manual confirm
      if (med) {
        await logMed(med, 'manual', 'Camera unavailable — manual confirmation.', '');
      }
      setVisionMsg('Logged without camera.');
      setPhase('confirmed');
    }
  }, [med, logMed]);

  const capture = useCallback(async () => {
    if (!videoRef.current || !med) return;
    setPhase('verifying');
    const canvas = document.createElement('canvas');
    canvas.width  = videoRef.current.videoWidth  || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    canvas.getContext('2d')!.drawImage(videoRef.current, 0, 0);
    const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
    stopCamera();

    try {
      const result = await verifyMedication(base64, med.name);
      setVisionMsg(result.description);
      setVisionConf(result.confidence);

      if (result.detected) {
        speak(`Confirmed. This looks like your ${med.name}. Please take it now.`).catch(console.error);
        setPhase('countdown');
        let c = 10;
        setCd(c);
        const iv = setInterval(() => {
          c--;
          setCd(c);
          if (c <= 0) {
            clearInterval(iv);
            logMed(med, result.confidence, result.description, base64).then(() => setPhase('confirmed'));
          }
        }, 1000);
      } else {
        const next = retries + 1;
        setRetries(next);
        if (next >= MAX_RETRY) {
          speak('I could not verify your medication. I am alerting your caregiver.').catch(console.error);
          await logMed(med, 'unconfirmed', result.description, base64, true);
          addAlert({ message: `Medication unconfirmed: ${med.name} for ${user?.name}`, timestamp: new Date().toISOString(), type: 'medication_unconfirmed' });
          setPhase('escalated');
        } else {
          speak('I could not see the medication clearly. Please try again.').catch(console.error);
          setPhase('rejected');
        }
      }
    } catch {
      setPhase('rejected');
    }
  }, [med, retries, user, addAlert, stopCamera, logMed]);

  const markManually = useCallback(async () => {
    if (!med) return;
    await logMed(med, 'manual', 'Manually confirmed by patient.', '');
    setVisionMsg('Recorded manually.');
    speak(`Great. I have recorded that you took your ${med.name}.`).catch(console.error);
    setPhase('confirmed');
  }, [med, logMed]);

  const reset = useCallback(() => {
    stopCamera();
    setMed(null);
    setPhase('list');
    setRetries(0);
    setVisionMsg('');
  }, [stopCamera]);

  const meds: Medication[] = user?.medications ?? [];

  // ── List ──────────────────────────────────────────────────────────
  if (phase === 'list') return (
    <div className="scroll-area" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="t-title" style={{ marginBottom: 4 }}>Medications</div>
      {meds.length === 0 && (
        <div className="glass" style={{ padding: 24, textAlign: 'center' }}>
          <p className="t-body" style={{ color: 'var(--muted)' }}>No medications added yet. Ask your caregiver to add them.</p>
        </div>
      )}
      {meds.map((m, i) => (
        <div key={i} className="glass" style={{ padding: '20px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 16, background: 'var(--blue-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="1.8" strokeLinecap="round">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 00 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 002 8.5c0 2.3 1.5 4.05 3 5.5l7 7z"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div className="t-title" style={{ fontSize: 18 }}>{m.name}</div>
            <div className="t-caption">{m.dosage} · {m.schedule.join(', ')}</div>
          </div>
          <button className="btn btn-primary" style={{ fontSize: 15, padding: '11px 18px', borderRadius: 14 }} onClick={() => selectMed(m)}>
            Take
          </button>
        </div>
      ))}
    </div>
  );

  // ── Cooldown ──────────────────────────────────────────────────────
  if (phase === 'cooldown') return (
    <div className="scroll-area" style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(245,158,11,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <div className="glass" style={{ padding: 20, width: '100%', textAlign: 'center' }}>
        <div className="t-title" style={{ marginBottom: 8 }}>Already taken</div>
        <p className="t-body">{cooldownMsg}</p>
      </div>
      <button className="btn btn-ghost" style={{ width: '100%', padding: 16 }} onClick={reset}>Back</button>
    </div>
  );

  // ── Confirm (choose camera or manual) ────────────────────────────
  if (phase === 'confirm') return (
    <div className="scroll-area" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="glass" style={{ padding: 20, textAlign: 'center' }}>
        <div className="t-title" style={{ marginBottom: 6 }}>{med?.name}</div>
        <div className="t-caption" style={{ fontSize: 16 }}>{med?.dosage}</div>
      </div>
      <div className="glass" style={{ padding: 20 }}>
        <p className="t-body" style={{ marginBottom: 16, textAlign: 'center' }}>How would you like to verify?</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="btn btn-primary" style={{ width: '100%', padding: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }} onClick={openCamera}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            Use Camera to Verify
          </button>
          <button className="btn btn-ghost" style={{ width: '100%', padding: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }} onClick={markManually}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="1.8" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Mark as Taken
          </button>
        </div>
      </div>
      <button className="btn btn-ghost" style={{ width: '100%', padding: 14 }} onClick={reset}>Cancel</button>
    </div>
  );

  // ── Camera + Verifying ────────────────────────────────────────────
  if (phase === 'camera' || phase === 'verifying') return (
    <div className="scroll-area" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ width: '100%', aspectRatio: '1', borderRadius: 28, overflow: 'hidden', position: 'relative', background: 'linear-gradient(145deg,#07101F,#1A2B4A)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <video ref={videoRef} playsInline muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        {['tl','tr','bl','br'].map(c => (
          <div key={c} style={{ position: 'absolute', width: 26, height: 26, borderColor: 'var(--blue)', borderStyle: 'solid', borderWidth: 0,
            borderTopWidth: c.startsWith('t') ? 3 : 0, borderBottomWidth: c.startsWith('b') ? 3 : 0,
            borderLeftWidth: c.endsWith('l') ? 3 : 0, borderRightWidth: c.endsWith('r') ? 3 : 0,
            borderRadius: c==='tl'?'6px 0 0 0':c==='tr'?'0 6px 0 0':c==='bl'?'0 0 0 6px':'0 0 6px 0',
            top: c.startsWith('t')?16:undefined, bottom: c.startsWith('b')?16:undefined,
            left: c.endsWith('l')?16:undefined, right: c.endsWith('r')?16:undefined }} />
        ))}
        {phase === 'verifying' && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(14,122,230,0.2)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="t-title" style={{ color: 'white' }}>Analyzing...</div>
          </div>
        )}
      </div>
      <div className="glass" style={{ padding: '14px 18px', textAlign: 'center' }}>
        <p className="t-body">Hold up your <strong style={{ color: 'var(--blue)' }}>{med?.name} {med?.dosage}</strong> to the camera.</p>
      </div>
      {phase === 'camera' && (
        <>
          <button className="btn btn-primary" style={{ width: '100%', padding: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }} onClick={capture}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="white"/></svg>
            Capture and Verify
          </button>
          <button className="btn btn-ghost" style={{ width: '100%', padding: 14 }} onClick={markManually}>Skip camera — Mark as taken</button>
          <button className="btn btn-ghost" style={{ width: '100%', padding: 14 }} onClick={reset}>Cancel</button>
        </>
      )}
    </div>
  );

  // ── Countdown ─────────────────────────────────────────────────────
  if (phase === 'countdown') return (
    <div className="scroll-area" style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div className="chip chip-success"><span className="chip-dot" />Vision confirmed — {visionConf} confidence</div>
      <p className="t-body" style={{ textAlign: 'center', color: 'var(--success)' }}>This looks like your medication. Please take it now.</p>
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="8"/>
        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--blue)" strokeWidth="8" strokeLinecap="round"
          strokeDasharray="264" strokeDashoffset={264 - (264 * countdown / 10)} transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 1s linear' }}/>
        <text x="50" y="57" textAnchor="middle" fontSize="26" fontWeight="800" fill="var(--blue)" fontFamily="Plus Jakarta Sans">{countdown}</text>
      </svg>
      <div className="t-caption">Recording in {countdown} seconds...</div>
    </div>
  );

  // ── Confirmed ─────────────────────────────────────────────────────
  if (phase === 'confirmed') return (
    <div className="scroll-area" style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(16,185,129,.3)' }}>
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div className="t-title" style={{ color: 'var(--success)', textAlign: 'center' }}>Medication Recorded</div>
      <div className="glass" style={{ padding: 18, width: '100%', textAlign: 'center' }}>
        <p className="t-body">{visionMsg || 'Successfully logged.'}</p>
      </div>
      <button className="btn btn-primary" style={{ width: '100%', padding: 18 }} onClick={reset}>Done</button>
    </div>
  );

  // ── Rejected ──────────────────────────────────────────────────────
  if (phase === 'rejected') return (
    <div className="scroll-area" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="chip chip-warning"><span className="chip-dot" />Could not verify — attempt {retries} of {MAX_RETRY}</div>
      <div className="glass" style={{ padding: 18 }}>
        <p className="t-body">I could not see the medication clearly. Try again or confirm manually.</p>
      </div>
      <button className="btn btn-primary" style={{ width: '100%', padding: 16 }} onClick={() => { setPhase('camera'); openCamera(); }}>
        Try Camera Again
      </button>
      <button className="btn btn-ghost" style={{ width: '100%', padding: 16 }} onClick={markManually}>
        Mark as Taken
      </button>
      <button className="btn btn-ghost" style={{ width: '100%', padding: 14 }} onClick={reset}>Cancel</button>
    </div>
  );

  // ── Escalated ─────────────────────────────────────────────────────
  return (
    <div className="scroll-area" style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(220,38,38,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
      <div className="t-title" style={{ color: 'var(--danger)', textAlign: 'center' }}>Caregiver Alerted</div>
      <div className="glass" style={{ padding: 18, width: '100%', textAlign: 'center' }}>
        <p className="t-body">Your caregiver has been notified that medication could not be confirmed.</p>
      </div>
      <button className="btn btn-ghost" style={{ width: '100%', padding: 14 }} onClick={reset}>Close</button>
    </div>
  );
}
