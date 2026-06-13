import { useCallback, useRef, useState } from 'react';
import { GROQ_API_KEY } from '../env';
import { proxyPost, usesApiProxy } from '../services/apiClient';

const GROQ_TRANSCRIBE_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const WHISPER_MODEL = 'whisper-large-v3-turbo';

const LISTEN_MAX_MS = 22_000;
const SILENCE_AFTER_SPEECH_MS = 2_400;
const MIN_SPEECH_MS = 500;
const VAD_RMS_THRESHOLD = 0.012;

function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod|Android/i.test(ua)) return true;
  return navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua);
}

function prefersRecorderMic(): boolean {
  if (isMobileDevice()) return true;
  if (typeof MediaRecorder === 'undefined') return false;
  const w = window as Window & {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  return !w.SpeechRecognition && !w.webkitSpeechRecognition;
}

function getSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const type of ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg']) {
    try {
      if (MediaRecorder.isTypeSupported(type)) return type;
    } catch {
      /* skip */
    }
  }
  return '';
}

function mimeToExt(mime: string): string {
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('ogg')) return 'ogg';
  return 'webm';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(',')[1] ?? '');
    };
    reader.onerror = () => reject(new Error('Could not read audio'));
    reader.readAsDataURL(blob);
  });
}

async function transcribeBlob(blob: Blob, mimeType: string): Promise<string> {
  if (blob.size < 1500) return '';

  if (usesApiProxy()) {
    const audio = await blobToBase64(blob);
    const data = await proxyPost<{ text?: string }>('/api/groq/transcribe', {
      audio,
      mimeType: mimeType || 'audio/webm',
      model: WHISPER_MODEL,
      language: 'en',
    });
    return (data.text ?? '').trim();
  }

  const apiKey = GROQ_API_KEY?.trim();
  if (!apiKey) throw new Error('No Groq API key available for voice');

  const formData = new FormData();
  formData.append('file', blob, `audio.${mimeToExt(mimeType)}`);
  formData.append('model', WHISPER_MODEL);
  formData.append('language', 'en');
  formData.append('response_format', 'json');

  const res = await fetch(GROQ_TRANSCRIBE_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Voice ${res.status}${err ? `: ${err.slice(0, 80)}` : ''}`);
  }

  const data = (await res.json()) as { text?: string };
  return (data.text ?? '').trim();
}

type SpeechRecognitionResult = {
  isFinal: boolean;
  length: number;
  [index: number]: { transcript: string };
};

type SpeechRecognitionResultList = {
  length: number;
  [index: number]: SpeechRecognitionResult;
};

type SpeechRecognitionEvent = {
  results: SpeechRecognitionResultList;
  resultIndex: number;
};

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
};

function extractTranscript(results: SpeechRecognitionResultList): string {
  let finals = '';
  let interim = '';
  for (let i = 0; i < results.length; i++) {
    const seg = results[i][0]?.transcript ?? '';
    if (results[i].isFinal) finals += seg;
    else interim += seg;
  }
  return (finals + interim).trim() || finals.trim();
}

function listenWithSpeech(): Promise<string> {
  return new Promise((resolve, reject) => {
    const SR = (window as Window & {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    }).SpeechRecognition ?? (window as Window & {
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    }).webkitSpeechRecognition;

    if (!SR) {
      reject(new Error('Speech recognition not supported'));
      return;
    }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 3;

    let settled = false;
    let bestText = '';
    let heardSpeech = false;
    let silenceTimer: ReturnType<typeof setTimeout> | null = null;
    let maxTimer: ReturnType<typeof setTimeout> | null = null;
    let lastResults: SpeechRecognitionResultList | null = null;

    const finish = (text: string) => {
      if (settled) return;
      settled = true;
      if (silenceTimer) clearTimeout(silenceTimer);
      if (maxTimer) clearTimeout(maxTimer);
      resolve(text);
    };

    const scheduleSilenceStop = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        try {
          recognition.stop();
        } catch {
          finish(bestText);
        }
      }, SILENCE_AFTER_SPEECH_MS);
    };

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      lastResults = e.results;
      const text = extractTranscript(e.results);
      if (text) {
        bestText = text;
        heardSpeech = true;
        scheduleSilenceStop();
      }
    };

    recognition.onspeechstart = () => {
      heardSpeech = true;
      if (silenceTimer) clearTimeout(silenceTimer);
    };

    recognition.onspeechend = () => {
      if (heardSpeech) scheduleSilenceStop();
    };

    recognition.onerror = (e: { error: string }) => {
      if (settled || e.error === 'aborted') return;
      if (e.error === 'no-speech') {
        try {
          recognition.stop();
        } catch {
          finish(bestText);
        }
        return;
      }
      settled = true;
      reject(new Error(e.error));
    };

    recognition.onend = () => {
      if (settled) return;
      if (lastResults) {
        const final = extractTranscript(lastResults);
        if (final.length > bestText.length) bestText = final;
      }
      finish(bestText);
    };

    maxTimer = setTimeout(() => {
      try {
        recognition.stop();
      } catch {
        finish(bestText);
      }
    }, LISTEN_MAX_MS);

    try {
      recognition.start();
    } catch (err) {
      settled = true;
      reject(err instanceof Error ? err : new Error('Could not start microphone'));
    }
  });
}

function listenWithRecorder(signal: { aborted: boolean }): Promise<string> {
  return new Promise((resolve, reject) => {
    navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      .then(async (stream) => {
        if (signal.aborted) {
          stream.getTracks().forEach((t) => t.stop());
          resolve('');
          return;
        }

        const mimeType = getSupportedMimeType();
        const chunks: Blob[] = [];
        const audioContext = new AudioContext();
        await audioContext.resume().catch(() => undefined);

        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);

        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        const startedAt = Date.now();
        let speechStarted = false;
        let speechStartedAt = 0;
        let lastLoudAt = 0;
        let vadFrame = 0;
        let maxTimer: ReturnType<typeof setTimeout> | null = null;

        const cleanup = () => {
          if (maxTimer) clearTimeout(maxTimer);
          cancelAnimationFrame(vadFrame);
          stream.getTracks().forEach((t) => t.stop());
          void audioContext.close().catch(() => undefined);
        };

        const stopRecorder = () => {
          if (recorder.state === 'recording') recorder.stop();
        };

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = async () => {
          cleanup();
          if (signal.aborted) {
            resolve('');
            return;
          }
          try {
            const blob = new Blob(chunks, { type: mimeType || 'audio/webm' });
            const text = await transcribeBlob(blob, mimeType || 'audio/webm');
            resolve(text);
          } catch (err) {
            reject(err instanceof Error ? err : new Error('Could not understand speech'));
          }
        };

        recorder.onerror = () => {
          cleanup();
          reject(new Error('Recording error'));
        };

        const monitorVolume = () => {
          if (signal.aborted) {
            stopRecorder();
            return;
          }

          const data = new Uint8Array(analyser.fftSize);
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const sample = (data[i] - 128) / 128;
            sum += sample * sample;
          }
          const rms = Math.sqrt(sum / data.length);
          const now = Date.now();

          if (rms > VAD_RMS_THRESHOLD) {
            if (!speechStarted) speechStartedAt = now;
            speechStarted = true;
            lastLoudAt = now;
          } else if (
            speechStarted &&
            now - lastLoudAt >= SILENCE_AFTER_SPEECH_MS &&
            now - speechStartedAt >= MIN_SPEECH_MS
          ) {
            stopRecorder();
            return;
          }

          if (now - startedAt >= LISTEN_MAX_MS) {
            stopRecorder();
            return;
          }

          vadFrame = requestAnimationFrame(monitorVolume);
        };

        recorder.start(200);
        vadFrame = requestAnimationFrame(monitorVolume);
        maxTimer = setTimeout(stopRecorder, LISTEN_MAX_MS + 500);
      })
      .catch((err) => {
        reject(err instanceof Error ? err : new Error('Microphone access denied'));
      });
  });
}

/** Hands-free Clara mic — recorder on mobile, speech API on desktop. No live transcript UI. */
export function useClaraVoice() {
  const [isListening, setIsListening] = useState(false);
  const abortRef = useRef(false);
  const activeRecognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);

  const stopListening = useCallback(() => {
    abortRef.current = true;
    try {
      activeRecognitionRef.current?.abort();
    } catch {
      activeRecognitionRef.current?.stop();
    }
    activeRecognitionRef.current = null;
    activeStreamRef.current?.getTracks().forEach((t) => t.stop());
    activeStreamRef.current = null;
    setIsListening(false);
  }, []);

  const startListening = useCallback((): Promise<string> => {
    abortRef.current = false;
    setIsListening(true);

    const signal = { get aborted() {
      return abortRef.current;
    } };

    const run = prefersRecorderMic()
      ? listenWithRecorder(signal)
      : listenWithSpeech();

    return run
      .then((text) => {
        if (abortRef.current) return '';
        setIsListening(false);
        return text;
      })
      .catch((err) => {
        setIsListening(false);
        throw err;
      });
  }, []);

  return { isListening, startListening, stopListening, isMobileMic: prefersRecorderMic() };
}
