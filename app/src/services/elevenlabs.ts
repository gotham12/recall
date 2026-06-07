import { ELEVENLABS_API_KEY } from '../env';
import { proxyPostBlob, usesApiProxy, warnDirectApiKeys } from './apiClient';

const VOICE_ID = 'EXAVITQu4vr4xnSDxMaL';
const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';
const MODEL_IDS = ['eleven_turbo_v2_5', 'eleven_flash_v2_5', 'eleven_multilingual_v2'];

let currentAudio: HTMLAudioElement | null = null;
let audioUnlocked = false;
let voicesReady: Promise<SpeechSynthesisVoice[]> | null = null;

export function isElevenLabsConfigured(): boolean {
  return usesApiProxy() || Boolean(ELEVENLABS_API_KEY?.trim());
}

/** Call synchronously inside a user tap/click handler so iOS allows later playback. */
export function unlockAudioPlayback(): void {
  if (audioUnlocked) return;

  try {
    const silent = new Audio(
      'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'
    );
    silent.volume = 0.01;
    void silent.play().then(() => {
      audioUnlocked = true;
      silent.pause();
    }).catch(() => {});
  } catch {
    // ignore
  }

  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx) {
      const ctx = new Ctx();
      void ctx.resume();
    }
  } catch {
    // ignore
  }

  if ('speechSynthesis' in window) {
    void loadVoices();
  }
}

export function stopSpeaking(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = '';
    currentAudio = null;
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export async function speak(text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;

  stopSpeaking();

  if (usesApiProxy()) {
    try {
      await speakElevenLabs(trimmed);
      return;
    } catch (err) {
      console.warn('ElevenLabs proxy TTS failed, falling back to browser TTS:', err);
    }
  } else if (isElevenLabsConfigured()) {
    try {
      await speakElevenLabs(trimmed);
      return;
    } catch (err) {
      console.warn('ElevenLabs TTS failed, falling back to browser TTS:', err);
    }
  } else {
    console.warn('ElevenLabs API key missing — using browser TTS');
  }

  await speakBrowser(trimmed);
}

async function speakElevenLabs(text: string): Promise<void> {
  warnDirectApiKeys();

  let lastError: Error | null = null;

  for (const modelId of MODEL_IDS) {
    try {
      const blob = await fetchElevenLabsAudio(text, modelId);
      await playAudioBlob(blob);
      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error('ElevenLabs TTS failed');
}

async function fetchElevenLabsAudio(text: string, modelId: string): Promise<Blob> {
  const payload = {
    text,
    model_id: modelId,
    voice_settings: {
      stability: 0.55,
      similarity_boost: 0.8,
      style: 0.25,
      use_speaker_boost: true,
    },
  };

  if (usesApiProxy()) {
    const blob = await proxyPostBlob('/api/elevenlabs/tts', {
      voiceId: VOICE_ID,
      ...payload,
    });
    if (!blob.size) throw new Error('Proxy returned empty audio');
    return blob;
  }

  const res = await fetch(`${ELEVENLABS_BASE}/text-to-speech/${VOICE_ID}`, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`ElevenLabs ${res.status}${detail ? `: ${detail.slice(0, 120)}` : ''}`);
  }

  const blob = await res.blob();
  if (!blob.size) throw new Error('ElevenLabs returned empty audio');
  return blob;
}

async function playAudioBlob(blob: Blob): Promise<void> {
  const url = URL.createObjectURL(blob);

  await new Promise<void>((resolve, reject) => {
    const audio = new Audio(url);
    audio.setAttribute('playsinline', 'true');
    currentAudio = audio;
    audio.onended = () => {
      URL.revokeObjectURL(url);
      currentAudio = null;
      resolve();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      currentAudio = null;
      reject(new Error('Audio playback failed'));
    };
    audio.play().catch((err) => {
      URL.revokeObjectURL(url);
      currentAudio = null;
      reject(err);
    });
  });
}

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!('speechSynthesis' in window)) {
    return Promise.resolve([]);
  }

  if (!voicesReady) {
    voicesReady = new Promise((resolve) => {
      const pick = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length) resolve(voices);
      };

      pick();
      window.speechSynthesis.onvoiceschanged = pick;
      setTimeout(() => resolve(window.speechSynthesis.getVoices()), 800);
    });
  }

  return voicesReady;
}

async function speakBrowser(text: string): Promise<void> {
  if (!('speechSynthesis' in window)) return;

  const voices = await loadVoices();
  window.speechSynthesis.cancel();

  await new Promise<void>((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.05;
    utterance.volume = 1;
    utterance.lang = 'en-US';

    const preferred =
      voices.find((v) => v.name === 'Samantha' && v.lang.startsWith('en')) ??
      voices.find((v) => v.name.includes('Samantha')) ??
      voices.find((v) => v.lang.startsWith('en') && v.name.includes('Karen')) ??
      voices.find((v) => v.lang.startsWith('en-US')) ??
      voices.find((v) => v.lang.startsWith('en'));

    if (preferred) utterance.voice = preferred;

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();

    window.speechSynthesis.speak(utterance);

    // iOS sometimes never fires onend — don't hang forever
    setTimeout(resolve, Math.min(30000, text.length * 80 + 2000));
  });
}
