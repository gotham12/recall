import { useState, useRef, useCallback, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { useACSE } from '../hooks/useACSE';
import { verifyMedication } from '../services/vision';
import { speak } from '../services/elevenlabs';
import { db, type Medication } from '../db/db';
import { isMedicationDueSoon } from '../lib/schedule';
import { isTylenolMed } from '../lib/medicationVision';
import { TYLENOL_REFERENCE_URL } from '../lib/assets';
import StudioIcon from './StudioIcon';

const COOLDOWN_HOURS = 6;
const MAX_RETRIES = 3;

type Phase =
  | 'list'
  | 'camera'
  | 'verifying'
  | 'countdown'
  | 'confirmed'
  | 'rejected'
  | 'cooldown'
  | 'manual_confirm';

export default function MedTracker() {
  const user = useAppStore((s) => s.user);
  const addSupervisorAlert = useAppStore((s) => s.addSupervisorAlert);
  const [selectedMed, setSelectedMed] = useState<Medication | null>(null);
  const [phase, setPhase] = useState<Phase>('list');
  const [retries, setRetries] = useState(0);
  const [countdown, setCountdown] = useState(10);
  const [cooldownMsg, setCooldownMsg] = useState('');
  const [visionMsg, setVisionMsg] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { recordMedicationReAttempt } = useACSE();

  const medications: Medication[] = user?.medications ?? [];
  const tylenolMed = medications.find((m) => isTylenolMed(m.name)) ?? medications[0];

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const clearCountdown = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
      clearCountdown();
    };
  }, [stopCamera, clearCountdown]);

  // Attach the live stream once the <video> element is actually mounted for the
  // camera phase. Fixes a race where getUserMedia resolved before the element existed.
  useEffect(() => {
    if (phase !== 'camera') return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (video && stream && video.srcObject !== stream) {
      video.srcObject = stream;
      void video.play().catch(() => {});
    }
  }, [phase]);

  const checkCooldown = useCallback(
    async (medName: string): Promise<boolean> => {
      if (!user?.id) return false;
      const cutoff = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();
      const recent = await db.medicationLogs
        .where('userId')
        .equals(user.id)
        .and((log) => log.medicationName === medName && log.timestamp > cutoff && log.confirmed)
        .first();
      return !!recent;
    },
    [user]
  );

  const logMedication = useCallback(async (
    med: Medication,
    confidence: 'high' | 'medium' | 'low' | 'manual' | 'unconfirmed',
    description: string,
    thumbnail: string
  ) => {
    if (!user?.id) return;
    const ts = new Date().toISOString();
    await db.medicationLogs.add({
      userId: user.id,
      medicationName: med.name,
      timestamp: ts,
      visionConfidence: confidence,
      visionDescription: description,
      imageThumbnail: thumbnail || undefined,
      confirmed: confidence !== 'unconfirmed',
    });
    await db.events.add({
      userId: user.id,
      timestamp: ts,
      type: 'user_action',
      title: `${med.name} taken`,
      description: `${med.name} ${med.dosage} taken. Vision confidence: ${confidence}. ${description}`,
      completed: true,
      source: 'system',
    });
  }, [user]);

  const escalate = useCallback(async (medName: string) => {
    if (!user?.id) return;
    const ts = new Date().toISOString();
    await db.medicationLogs.add({
      userId: user.id,
      medicationName: medName,
      timestamp: ts,
      visionConfidence: 'unconfirmed',
      visionDescription: 'Could not verify after 3 attempts.',
      confirmed: false,
    });
    await db.events.add({
      userId: user.id,
      timestamp: ts,
      type: 'system_alert',
      title: `${medName} — unconfirmed`,
      description: `Vision could not confirm ${medName} after ${MAX_RETRIES} attempts.`,
      completed: false,
      source: 'system',
    });

    addSupervisorAlert({
      message: `${medName} could not be verified — please check in with ${user.name.split(' ')[0]}.`,
      timestamp: ts,
      type: 'medication_unconfirmed',
      persist: true,
    });
  }, [user, addSupervisorAlert]);

  const startCountdown = useCallback(() => {
    clearCountdown();
    let c = 10;
    setCountdown(c);
    countdownTimerRef.current = setInterval(() => {
      c--;
      setCountdown(c);
      if (c <= 0) {
        clearCountdown();
        setPhase('confirmed');
        void speak('Thank you. Medication recorded successfully.');
      }
    }, 1000);
  }, [clearCountdown]);

  const startCamera = useCallback(async (med: Medication) => {
    setSelectedMed(med);

    const onCooldown = await checkCooldown(med.name);
    if (onCooldown) {
      recordMedicationReAttempt();
      const log = await db.medicationLogs
        .where('userId').equals(user!.id!)
        .and((l) => l.medicationName === med.name)
        .last();
      const minsAgo = log
        ? Math.round((Date.now() - new Date(log.timestamp).getTime()) / 60000)
        : 0;
      setCooldownMsg(
        `You already took ${med.name} ${minsAgo} minutes ago. Your next dose is in about ${COOLDOWN_HOURS * 60 - minsAgo} minutes.`
      );
      await speak(`You already took ${med.name} ${minsAgo} minutes ago.`);
      setPhase('cooldown');
      return;
    }

    setPhase('camera');
    setRetries(0);
    await speak(`It's time to take your ${med.name}. Please show me the medication.`);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setVisionMsg('Camera access is not available.');
      await speak('Camera access is not available. Please confirm manually.');
      setPhase('manual_confirm');
    }
  }, [checkCooldown, recordMedicationReAttempt, user]);

  const captureAndVerify = useCallback(async () => {
    if (!videoRef.current || !selectedMed) return;
    setPhase('verifying');

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 320;
    canvas.height = videoRef.current.videoHeight || 240;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    const base64 = dataUrl.split(',')[1];

    stopCamera();

    try {
      const result = await verifyMedication(base64, selectedMed.name);

      if (result.detected) {
        setVisionMsg(`Confirmed — ${result.description}`);
        await speak(`Confirmed — this looks like your ${selectedMed.name}. Please take it now.`);
        await logMedication(selectedMed, result.confidence, result.description, dataUrl);
        setPhase('countdown');
        startCountdown();
      } else {
        const newRetries = retries + 1;
        setRetries(newRetries);
        if (newRetries >= MAX_RETRIES) {
          setVisionMsg("I couldn't see your medication clearly after multiple attempts.");
          await speak("I couldn't verify your medication. I'll let your caregiver know.");
          await escalate(selectedMed.name);
          setPhase('rejected');
        } else {
          setVisionMsg(`I couldn't see your medication clearly. ${MAX_RETRIES - newRetries} attempt(s) remaining.`);
          await speak(`I couldn't see your medication clearly. Please try again.`);
          setPhase('camera');
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
          }
        }
      }
    } catch {
      setVisionMsg('Vision service unavailable. Please confirm manually.');
      await speak('I could not verify automatically. Please confirm if you took your medication.');
      setPhase('manual_confirm');
    }
  }, [selectedMed, retries, stopCamera, logMedication, startCountdown, escalate]);

  const confirmManually = useCallback(async () => {
    if (!selectedMed) return;
    await logMedication(selectedMed, 'manual', 'Patient confirmed manually.', '');
    setVisionMsg('Recorded with manual confirmation.');
    setPhase('countdown');
    startCountdown();
    await speak('Thank you. Please take your medication now.');
  }, [selectedMed, logMedication, startCountdown]);

  const reset = () => {
    stopCamera();
    clearCountdown();
    setPhase('list');
    setSelectedMed(null);
    setRetries(0);
    setVisionMsg('');
    setCooldownMsg('');
  };

  const demoVerify = useCallback(async (med: Medication) => {
    setSelectedMed(med);
    setVisionMsg(`Demo verified — ${med.name} ${med.dosage}`);
    await speak(`Confirmed — your ${med.name}. Please take it now.`);
    await logMedication(med, 'high', 'Demo verification — pill bottle matched.', '');
    setPhase('countdown');
    startCountdown();
  }, [logMedication, startCountdown]);

  const btnStyle = {
    minHeight: 52,
    padding: '14px 24px',
    fontSize: 18,
    fontWeight: 600,
  } as const;

  return (
    <div className="med-tracker studio-scroll">
      {phase === 'list' && (
        <div className="med-tracker__list">
          <h2 className="studio-page-title">Your Medications</h2>
          {medications.length === 0 && (
            <p className="studio-text-muted" style={{ fontSize: 20 }}>
              No medications configured. Ask your caregiver to set them up.
            </p>
          )}
          {medications.map((med, i) => {
            const dueSoon = isMedicationDueSoon(med.schedule);
            return (
              <div key={i} className={`card med-tracker__card ${dueSoon ? 'med-tracker__card--due' : ''}`}>
                <div className="med-tracker__card-row">
                  <div className="med-tracker__card-info">
                    <div className="med-tracker__card-head">
                      <p className="studio-text-bright med-tracker__med-name">
                        <StudioIcon name="meds" size={24} />
                        {med.name}
                      </p>
                      {dueSoon && <span className="med-tracker__due-badge">Due now</span>}
                    </div>
                    <p className="med-tracker__dosage">{med.dosage}</p>
                    <div className="med-tracker__schedule">
                      {med.schedule.map((time) => (
                        <span key={time} className="schedule-chip">{time}</span>
                      ))}
                    </div>
                  </div>
                  <button
                    className="btn-electric tap-feedback med-tracker__take-btn"
                    onClick={() => startCamera(med)}
                  >
                    Take Now
                  </button>
                </div>
              </div>
            );
          })}
          {tylenolMed && (
            <button
              type="button"
              className="med-demo-verify tap-feedback"
              onClick={() => void demoVerify(tylenolMed)}
            >
              <StudioIcon name="meds" size={18} />
              Demo verify Tylenol (no camera)
            </button>
          )}
        </div>
      )}

      {phase === 'cooldown' && (
        <div className="card animate-fadeIn med-tracker__center-card">
          <div className="event-icon-badge" style={{ width: 56, height: 56, margin: '0 auto 16px' }}>
            <StudioIcon name="calendar" size={28} />
          </div>
          <p className="studio-text-bright" style={{ fontSize: 22, marginBottom: 20 }}>{cooldownMsg}</p>
          <button className="btn-electric tap-feedback" style={btnStyle} onClick={reset}>Got it</button>
        </div>
      )}

      {phase === 'camera' && (
        <div className="med-tracker__camera">
          <h2 className="studio-page-title" style={{ marginBottom: 8 }}>
            Show me: {selectedMed?.name}
          </h2>
          <p className="studio-text-muted" style={{ fontSize: 18, margin: '0 0 12px' }}>
            {selectedMed && isTylenolMed(selectedMed.name)
              ? 'Hold the red TYLENOL label facing the camera.'
              : 'Hold your medication in front of the camera.'}
          </p>
          {selectedMed && isTylenolMed(selectedMed.name) && (
            <div className="med-tracker__reference">
              <img src={TYLENOL_REFERENCE_URL} alt="" className="med-tracker__reference-img" />
              <p className="med-tracker__reference-hint">Example: white bottle, red TYLENOL label</p>
            </div>
          )}
          <div className="med-tracker__video-wrap">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="med-tracker__video"
            />
          </div>
          {retries > 0 && (
            <p style={{ color: '#F59E0B', fontSize: 18, textAlign: 'center' }}>
              Attempt {retries + 1} of {MAX_RETRIES}
            </p>
          )}
          <button
            className="btn-electric tap-feedback med-tracker__action-btn"
            onClick={captureAndVerify}
            style={btnStyle}
          >
            <StudioIcon name="check" size={22} />
            Capture &amp; Verify
          </button>
          <button className="med-tracker__cancel tap-feedback" onClick={reset}>
            Cancel
          </button>
        </div>
      )}

      {phase === 'verifying' && (
        <div className="card animate-fadeIn med-tracker__center-card">
          <div className="skeleton" style={{ width: 80, height: 80, borderRadius: '50%', margin: '0 auto 20px' }} />
          <p className="studio-text-bright" style={{ fontSize: 22 }}>Verifying your medication…</p>
        </div>
      )}

      {phase === 'manual_confirm' && (
        <div className="card animate-fadeIn med-tracker__center-card">
          <div className="event-icon-badge" style={{ width: 56, height: 56, margin: '0 auto 16px' }}>
            <StudioIcon name="warning" size={28} />
          </div>
          <p className="studio-text-bright" style={{ fontSize: 22, marginBottom: 8 }}>
            Manual confirmation
          </p>
          <p className="studio-text-muted" style={{ fontSize: 18, marginBottom: 24 }}>{visionMsg}</p>
          <p className="studio-text-bright" style={{ fontSize: 20, marginBottom: 20 }}>
            Did you take your {selectedMed?.name}?
          </p>
          <div className="med-tracker__confirm-actions">
            <button className="btn-electric tap-feedback" style={btnStyle} onClick={confirmManually}>
              Yes, I took it
            </button>
            <button className="studio-btn studio-btn--ghost tap-feedback" style={btnStyle} onClick={reset}>
              Not yet
            </button>
          </div>
        </div>
      )}

      {phase === 'countdown' && (
        <div className="card animate-fadeIn med-tracker__center-card">
          <div className="event-icon-badge" style={{ width: 56, height: 56, margin: '0 auto 12px' }}>
            <StudioIcon name="success" size={28} />
          </div>
          <p className="studio-text-bright" style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>{visionMsg}</p>
          <p className="studio-text-bright" style={{ fontSize: 20, marginBottom: 20 }}>
            Please take your medication now.
          </p>
          <div className="med-tracker__countdown">{countdown}</div>
        </div>
      )}

      {phase === 'confirmed' && (
        <div className="card animate-fadeIn med-tracker__center-card">
          <div className="event-icon-badge" style={{ width: 64, height: 64, margin: '0 auto 16px' }}>
            <StudioIcon name="success" size={32} />
          </div>
          <p className="studio-text-bright" style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>
            {selectedMed?.name} recorded!
          </p>
          <p className="studio-text-muted" style={{ fontSize: 20, marginBottom: 24 }}>
            Great job taking care of yourself.
          </p>
          <button className="btn-electric tap-feedback" style={btnStyle} onClick={reset}>Done</button>
        </div>
      )}

      {phase === 'rejected' && (
        <div className="card animate-fadeIn med-tracker__center-card">
          <div className="event-icon-badge" style={{ width: 56, height: 56, margin: '0 auto 16px' }}>
            <StudioIcon name="warning" size={28} />
          </div>
          <p style={{ fontSize: 22, color: '#F59E0B', fontWeight: 600, marginBottom: 8 }}>
            Could Not Verify
          </p>
          <p className="studio-text-bright" style={{ fontSize: 20, marginBottom: 24 }}>{visionMsg}</p>
          <p className="studio-text-muted" style={{ fontSize: 18, marginBottom: 24 }}>
            Your caregiver has been notified.
          </p>
          <button className="btn-electric tap-feedback" style={btnStyle} onClick={reset}>OK</button>
        </div>
      )}
    </div>
  );
}
