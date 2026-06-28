import { useCallback, useRef, useState } from 'react';
import { GROQ_API_KEY } from '../env';
import { proxyPost } from '../services/apiClient';
import { prepareMicForScreenRecord, releaseMicAfterClara } from '../lib/iosAudioSession';

// ── Constants ─────────────────────────────────────────────────────────────────
const GROQ_TRANSCRIBE_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const WHISPER_MODEL = 'whisper-large-v3-turbo';

const LISTEN_MAX_MS = 20_000;
const SILENCE_AFTER_SPEECH_MS = 900;
const MIN_SPEECH_MS = 300;
const VAD_THRESHOLD = 0.006;

// ── Capability detection ──────────────────────────────────────────────────────
function getSpeechRecognitionClass(): (new () => SpeechRecognitionInstance) | null {
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// ── SpeechRecognition types ───────────────────────────────────────────────────
type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
};
type SpeechResultList = {
  length: number;
  [i: number]: { isFinal: boolean; length: number; [j: number]: { transcript: string } };
};
type SpeechEvent = { results: SpeechResultList };

function extractTranscript(results: SpeechResultList): string {
  let finals = '';
  let interim = '';
  for (let i = 0; i < results.length; i++) {
    const seg = results[i][0]?.transcript ?? '';
    if (results[i].isFinal) finals += seg;
    else interim += seg;
  }
  return (finals || interim).trim();
}

// ── Web Speech API path (preferred — works on iOS Safari, Chrome, Edge) ───────
async function listenWithSpeechAPI(abortSignal: { aborted: boolean }): Promise<string> {
  await prepareMicForScreenRecord();
  return listenWithSpeechAPIInner(abortSignal);
}

function listenWithSpeechAPIInner(abortSignal: { aborted: boolean }): Promise<string> {
  return new Promise((resolve, reject) => {
    const SR = getSpeechRecognitionClass();
    if (!SR) { reject(new Error('Speech recognition not available')); return; }

    const rec = new SR();
    // iOS Safari works better with continuous=false (it stops automatically after a phrase)
    const ios = isIOS();
    rec.continuous = !ios;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.maxAlternatives = 1;

    let settled = false;
    let bestText = '';
    let silenceTimer: ReturnType<typeof setTimeout> | null = null;
    let maxTimer: ReturnType<typeof setTimeout> | null = null;
    let lastResults: SpeechResultList | null = null;

    const finish = (text: string) => {
      if (settled) return;
      settled = true;
      if (silenceTimer) clearTimeout(silenceTimer);
      if (maxTimer) clearTimeout(maxTimer);
      resolve(text.trim());
    };

    const scheduleSilence = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        if (abortSignal.aborted) { finish(''); return; }
        try { rec.stop(); } catch { finish(bestText); }
      }, SILENCE_AFTER_SPEECH_MS);
    };

    rec.onresult = (e: SpeechEvent) => {
      lastResults = e.results;
      const text = extractTranscript(e.results);
      if (text) {
        bestText = text;
        // On iOS, a final result means the recognition is done — resolve immediately
        if (ios && e.results[e.results.length - 1]?.isFinal) {
          finish(bestText);
          return;
        }
        scheduleSilence();
      }
    };

    rec.onspeechstart = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
    };

    rec.onspeechend = () => {
      if (bestText) scheduleSilence();
    };

    rec.onerror = (e: { error: string }) => {
      if (settled || e.error === 'aborted') return;
      if (e.error === 'no-speech') {
        try { rec.stop(); } catch { finish(''); }
        return;
      }
      if (e.error === 'not-allowed') {
        settled = true;
        reject(new Error('Microphone permission denied'));
        return;
      }
      // Other errors (network, service-not-allowed) — resolve with whatever we have
      finish(bestText);
    };

    rec.onend = () => {
      if (settled) return;
      if (lastResults) {
        const t = extractTranscript(lastResults);
        if (t.length > bestText.length) bestText = t;
      }
      finish(bestText);
    };

    maxTimer = setTimeout(() => {
      try { rec.stop(); } catch { finish(bestText); }
    }, LISTEN_MAX_MS);

    if (abortSignal.aborted) { resolve(''); return; }
    try {
      rec.start();
    } catch (err) {
      settled = true;
      reject(err instanceof Error ? err : new Error('Could not start microphone'));
    }
  });
}

// ── MediaRecorder + Whisper path (fallback when Speech API unavailable) ────────
function getSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const t of ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg']) {
    try { if (MediaRecorder.isTypeSupported(t)) return t; } catch { /* skip */ }
  }
  return '';
}

function mimeToExt(mime: string): string {
  if (mime.includes('mp4')) return 'm4a';
  if (mime.includes('ogg')) return 'ogg';
  return 'webm';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('Could not read audio'));
    reader.readAsDataURL(blob);
  });
}

async function transcribeBlob(blob: Blob, mimeType: string): Promise<string> {
  if (blob.size < 500) return '';

  const ext = mimeToExt(mimeType);
  console.log('[Clara STT] transcribing blob:', blob.size, 'bytes,', mimeType);

  // 1️⃣ Direct Groq API (preferred — bypasses Cloudflare worker)
  const apiKey = GROQ_API_KEY?.trim();
  if (apiKey) {
    try {
      const fd = new FormData();
      fd.append('file', blob, `audio.${ext}`);
      fd.append('model', WHISPER_MODEL);
      fd.append('language', 'en');
      fd.append('response_format', 'json');

      const res = await fetch(GROQ_TRANSCRIBE_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: fd,
      });

      if (res.ok) {
        const data = (await res.json()) as { text?: string };
        const text = (data.text ?? '').trim();
        console.log('[Clara STT] Groq direct success:', JSON.stringify(text));
        return text;
      }
      const errText = await res.text().catch(() => '');
      console.warn('[Clara STT] Groq direct failed:', res.status, errText.slice(0, 120));
    } catch (err) {
      console.warn('[Clara STT] Groq direct threw:', err);
    }
  } else {
    console.warn('[Clara STT] No Groq API key — skipping direct path');
  }

  // 2️⃣ Proxy fallback
  try {
    const audio = await blobToBase64(blob);
    const data = await proxyPost<{ text?: string }>('/api/groq/transcribe', {
      audio,
      mimeType: mimeType || 'audio/webm',
      model: WHISPER_MODEL,
      language: 'en',
    });
    const text = (data.text ?? '').trim();
    console.log('[Clara STT] Proxy success:', JSON.stringify(text));
    return text;
  } catch (err) {
    console.warn('[Clara STT] Proxy fallback failed:', err);
    throw new Error('Could not transcribe — check internet connection.');
  }
}

async function listenWithRecorder(abortSignal: { aborted: boolean }): Promise<string> {
  await prepareMicForScreenRecord();
  return listenWithRecorderInner(abortSignal);
}

function listenWithRecorderInner(abortSignal: { aborted: boolean }): Promise<string> {
  return new Promise((resolve, reject) => {
    // Try with full constraints first, fall back to plain `audio: true`
    const tryGetMedia = (constraints: MediaStreamConstraints) =>
      navigator.mediaDevices.getUserMedia(constraints);

    tryGetMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      .catch(() => tryGetMedia({ audio: true }))
      .then(async (stream) => {
        if (abortSignal.aborted) { stream.getTracks().forEach((t) => t.stop()); resolve(''); return; }

        const mimeType = getSupportedMimeType();
        const chunks: Blob[] = [];
        const audioCtx = new AudioContext();
        await audioCtx.resume().catch(() => {});
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);

        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        const startedAt = Date.now();
        let speechStarted = false;
        let speechStartedAt = 0;
        let lastLoudAt = 0;
        let rafId = 0;
        let maxTimer: ReturnType<typeof setTimeout> | null = null;
        let stopped = false;

        const cleanup = () => {
          if (maxTimer) clearTimeout(maxTimer);
          cancelAnimationFrame(rafId);
          stream.getTracks().forEach((t) => t.stop());
          audioCtx.close().catch(() => {});
        };

        const doStop = () => {
          if (stopped) return;
          stopped = true;
          if (recorder.state === 'recording') recorder.stop();
        };

        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

        recorder.onstop = async () => {
          cleanup();
          if (abortSignal.aborted) { resolve(''); return; }
          try {
            const blob = new Blob(chunks, { type: mimeType || 'audio/webm' });
            const text = await transcribeBlob(blob, mimeType || 'audio/webm');
            resolve(text);
          } catch (err) {
            reject(err instanceof Error ? err : new Error('Transcription failed'));
          }
        };

        recorder.onerror = () => { cleanup(); reject(new Error('Recording error')); };

        const vad = () => {
          if (abortSignal.aborted || stopped) { doStop(); return; }
          const buf = new Uint8Array(analyser.fftSize);
          analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const s = (buf[i] - 128) / 128;
            sum += s * s;
          }
          const rms = Math.sqrt(sum / buf.length);
          const now = Date.now();

          if (rms > VAD_THRESHOLD) {
            if (!speechStarted) { speechStarted = true; speechStartedAt = now; }
            lastLoudAt = now;
          } else if (speechStarted && now - lastLoudAt >= SILENCE_AFTER_SPEECH_MS && now - speechStartedAt >= MIN_SPEECH_MS) {
            doStop(); return;
          }

          if (now - startedAt >= LISTEN_MAX_MS) { doStop(); return; }
          rafId = requestAnimationFrame(vad);
        };

        recorder.start(100);
        rafId = requestAnimationFrame(vad);
        maxTimer = setTimeout(doStop, LISTEN_MAX_MS + 1000);
      })
      .catch((err) => {
        const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
        if (msg.includes('denied') || msg.includes('not-allowed')) {
          reject(new Error('Microphone permission denied'));
        } else {
          reject(new Error('Could not access microphone'));
        }
      });
  });
}

// ── Public hook ───────────────────────────────────────────────────────────────
export function useClaraVoice() {
  const [isListening, setIsListening] = useState(false);
  const abortRef = useRef(false);

  // Use Speech API when available (covers iOS Safari, Chrome, Edge, Firefox).
  // Fall back to MediaRecorder+Whisper only when Speech API is truly unavailable.
  const speechAvailable = typeof window !== 'undefined' && getSpeechRecognitionClass() !== null;

  const stopListening = useCallback((opts?: { releaseMic?: boolean }) => {
    abortRef.current = true;
    setIsListening(false);
    if (opts?.releaseMic !== false) {
      void releaseMicAfterClara();
    }
  }, []);

  const startListening = useCallback((): Promise<string> => {
    abortRef.current = false;
    setIsListening(true);

    const signal = { get aborted() { return abortRef.current; } };

    const run = speechAvailable
      ? listenWithSpeechAPI(signal)
      : listenWithRecorder(signal);

    return run
      .then((text) => {
        setIsListening(false);
        return abortRef.current ? '' : text;
      })
      .catch((err) => {
        setIsListening(false);
        throw err;
      });
  }, [speechAvailable]);

  return {
    isListening,
    startListening,
    stopListening,
    isRecorderMode: !speechAvailable,
  };
}
