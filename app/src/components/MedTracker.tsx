import { useState, useRef, useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import { useACSE } from '../hooks/useACSE';
import { verifyMedication } from '../services/vision';
import { speak } from '../services/elevenlabs';
import { db, type Medication } from '../db/db';

const COOLDOWN_HOURS = 6;
const MAX_RETRIES = 3;

export default function MedTracker() {
  const user = useAppStore((s) => s.user);
  const [selectedMed, setSelectedMed] = useState<Medication | null>(null);
  const [phase, setPhase] = useState<
    'list' | 'camera' | 'verifying' | 'countdown' | 'confirmed' | 'rejected' | 'cooldown'
  >('list');
  const [retries, setRetries] = useState(0);
  const [countdown, setCountdown] = useState(10);
  const [cooldownMsg, setCooldownMsg] = useState('');
  const [visionMsg, setVisionMsg] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { recordMedicationReAttempt } = useACSE();

  const medications: Medication[] = user?.medications ?? [];

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
      await speak('Camera access is not available. Please confirm manually.');
      await logMedication(med, 'manual', 'Camera unavailable — manual confirmation.', '');
      setPhase('confirmed');
    }
  }, [checkCooldown, recordMedicationReAttempt, user]);

  const captureAndVerify = useCallback(async () => {
    if (!videoRef.current || !selectedMed) return;
    setPhase('verifying');

    // Capture frame
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
          // Restart camera
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
      await logMedication(selectedMed, 'manual', 'Vision unavailable — manual confirmation.', '');
      setPhase('confirmed');
    }
  }, [selectedMed, retries]);

  const startCountdown = useCallback(() => {
    let c = 10;
    setCountdown(c);
    const timer = setInterval(() => {
      c--;
      setCountdown(c);
      if (c <= 0) {
        clearInterval(timer);
        setPhase('confirmed');
        speak('Thank you. Medication recorded successfully.');
      }
    }, 1000);
  }, []);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const reset = () => {
    stopCamera();
    setPhase('list');
    setSelectedMed(null);
    setRetries(0);
    setVisionMsg('');
    setCooldownMsg('');
  };

  const logMedication = async (
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
  };

  const escalate = async (medName: string) => {
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
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
      {phase === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h2 style={{ fontSize: 26, color: '#ffffff', margin: '0 0 8px' }}>
            Your Medications
          </h2>
          {medications.length === 0 && (
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 20 }}>
              No medications configured. Ask your caregiver to set them up.
            </p>
          )}
          {medications.map((med, i) => (
            <div key={i} className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: 24, fontWeight: 600, color: '#ffffff', margin: '0 0 4px' }}>
                    💊 {med.name}
                  </p>
                  <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.85)', margin: '0 0 4px' }}>
                    {med.dosage}
                  </p>
                  <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.9)', margin: 0 }}>
                    {med.schedule.join(' & ')}
                  </p>
                </div>
                <button
                  className="tap-feedback"
                  onClick={() => startCamera(med)}
                  style={{
                    background: 'rgba(255,255,255,0.14)',
                    border: '1px solid rgba(255,255,255,0.22)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 14,
                    padding: '12px 16px',
                    fontSize: 16,
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Take Now
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {phase === 'cooldown' && (
        <div className="card animate-fadeIn" style={{ padding: '28px 24px', textAlign: 'center', margin: '20px 0' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏰</div>
          <p style={{ fontSize: 22, color: '#ffffff', marginBottom: 20 }}>{cooldownMsg}</p>
          <button className="btn-electric" onClick={reset}>Got it</button>
        </div>
      )}

      {phase === 'camera' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h2 style={{ fontSize: 24, color: '#ffffff', margin: 0 }}>
            Show me: {selectedMed?.name}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 18, margin: 0 }}>
            Hold your medication in front of the camera.
          </p>
          <div style={{ borderRadius: 16, overflow: 'hidden', background: '#000', aspectRatio: '4/3' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
          {retries > 0 && (
            <p style={{ color: '#F59E0B', fontSize: 18, textAlign: 'center' }}>
              Attempt {retries + 1} of {MAX_RETRIES}
            </p>
          )}
          <button className="btn-electric tap-feedback" onClick={captureAndVerify}>
            📸 Capture &amp; Verify
          </button>
          <button onClick={reset} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.85)', fontSize: 18, cursor: 'pointer', padding: 8 }}>
            Cancel
          </button>
        </div>
      )}

      {phase === 'verifying' && (
        <div className="card animate-fadeIn" style={{ padding: '40px 24px', textAlign: 'center' }}>
          <div className="skeleton" style={{ width: 80, height: 80, borderRadius: '50%', margin: '0 auto 20px' }} />
          <p style={{ fontSize: 22, color: '#ffffff' }}>Verifying your medication...</p>
        </div>
      )}

      {phase === 'countdown' && (
        <div className="card animate-fadeIn" style={{ padding: '32px 24px', textAlign: 'center', margin: '20px 0' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <p className="studio-text-bright" style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>{visionMsg}</p>
          <p style={{ fontSize: 20, color: '#ffffff', marginBottom: 20 }}>
            Please take your medication now.
          </p>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.14)',
              border: '1px solid rgba(255,255,255,0.22)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
              fontSize: 32,
              color: 'white',
              fontWeight: 700,
            }}
          >
            {countdown}
          </div>
        </div>
      )}

      {phase === 'confirmed' && (
        <div className="card animate-fadeIn" style={{ padding: '32px 24px', textAlign: 'center', margin: '20px 0' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
          <p className="studio-text-bright" style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>
            {selectedMed?.name} recorded!
          </p>
          <p style={{ fontSize: 20, color: 'rgba(255,255,255,0.85)', marginBottom: 24 }}>
            Great job taking care of yourself.
          </p>
          <button className="btn-electric tap-feedback" onClick={reset}>Done</button>
        </div>
      )}

      {phase === 'rejected' && (
        <div className="card animate-fadeIn" style={{ padding: '28px 24px', textAlign: 'center', margin: '20px 0' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <p style={{ fontSize: 22, color: '#F59E0B', fontWeight: 600, marginBottom: 8 }}>
            Could Not Verify
          </p>
          <p style={{ fontSize: 20, color: '#ffffff', marginBottom: 24 }}>{visionMsg}</p>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.85)', marginBottom: 24 }}>
            Your caregiver has been notified.
          </p>
          <button className="btn-electric tap-feedback" onClick={reset}>OK</button>
        </div>
      )}
    </div>
  );
}
