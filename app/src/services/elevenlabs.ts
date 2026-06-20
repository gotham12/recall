import { ELEVENLABS_API_KEY } from '../env';
import { proxyPostBlob, usesApiProxy, warnDirectApiKeys } from './apiClient';

const VOICE_ID = 'EXAVITQu4vr4xnSDxMaL';
/** Jessica — warm, natural American voice for Clara */
const CLARA_VOICE_ID = 'cgSgspJ2msm6clMCkdW9';
const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';
const MODEL_IDS = ['eleven_turbo_v2_5', 'eleven_flash_v2_5', 'eleven_multilingual_v2'];
const CLARA_MODEL_IDS = ['eleven_multilingual_v2', 'eleven_turbo_v2_5', 'eleven_flash_v2_5'];

let currentAudio: HTMLAudioElement | null = null;
let audioUnlocked = false;
let voicesReady: Promise<SpeechSynthesisVoice[]> | null = null;
let speakGeneration = 0;
let interruptPlayback: (() => void) | null = null;
let speakChain: Promise<void> = Promise.resolve();

/** Clara's calming delivery — slow, warm, gentle */
const CLARA_SPEECH_RATE = 0.58;
const CLARA_SPEECH_PITCH = 0.82;
const CLARA_SPEECH_VOLUME = 1.0;
const CLARA_SENTENCE_PAUSE_MS = 480;

function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

/** Mobile browsers block async HTMLAudioElement — speechSynthesis is reliable. */
function prefersBrowserTTS(): boolean {
  return isIOSDevice() || isMobileDevice();
}

export interface SpeakOptions {
  /** Softer, more affectionate delivery for memory recap */
  warm?: boolean;
  /** Clara companion — warmest, slowest, most comforting delivery */
  clara?: boolean;
}

export function isElevenLabsConfigured(): boolean {
  return usesApiProxy() || Boolean(ELEVENLABS_API_KEY?.trim());
}

/** Prime speechSynthesis during a user gesture so iOS allows later async speak. */
export function primeSpeechSynthesis(): void {
  if (!('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance('Hello');
    u.volume = 0.01;
    u.rate = CLARA_SPEECH_RATE;
    u.pitch = CLARA_SPEECH_PITCH;
    window.speechSynthesis.speak(u);
  } catch {
    // ignore
  }
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
  speakGeneration += 1;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.onended = null;
    currentAudio.onerror = null;
    currentAudio.src = '';
    currentAudio = null;
  }
  if (interruptPlayback) {
    interruptPlayback();
    interruptPlayback = null;
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export async function speak(text: string, options?: SpeakOptions): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;

  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const prev = speakChain;
  speakChain = gate;
  await prev;

  try {
    stopSpeaking();
    const myGen = speakGeneration;

    // iOS: use device voice — HTMLAudioElement often fails after async LLM delay
    if (prefersBrowserTTS()) {
      if (myGen !== speakGeneration) return;
      await speakBrowser(trimmed, myGen, options);
      return;
    }

    if (usesApiProxy()) {
      try {
        await speakElevenLabs(trimmed, myGen, options);
        return;
      } catch (err) {
        console.warn('ElevenLabs proxy TTS failed, falling back to browser TTS:', err);
      }
    } else if (isElevenLabsConfigured()) {
      try {
        await speakElevenLabs(trimmed, myGen, options);
        return;
      } catch (err) {
        console.warn('ElevenLabs TTS failed, falling back to browser TTS:', err);
      }
    } else {
      console.warn('ElevenLabs API key missing — using browser TTS');
    }

    if (myGen !== speakGeneration) return;
    await speakBrowser(trimmed, myGen, options);
  } finally {
    release();
  }
}

async function speakElevenLabs(text: string, gen: number, options?: SpeakOptions): Promise<void> {
  warnDirectApiKeys();

  let lastError: Error | null = null;
  const models = options?.clara ? CLARA_MODEL_IDS : MODEL_IDS;

  for (const modelId of models) {
    if (gen !== speakGeneration) return;
    try {
      const blob = await fetchElevenLabsAudio(text, modelId, options);
      if (gen !== speakGeneration) return;
      await playAudioBlob(blob, gen);
      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error('ElevenLabs TTS failed');
}

async function fetchElevenLabsAudio(text: string, modelId: string, options?: SpeakOptions): Promise<Blob> {
  const clara = options?.clara ?? false;
  const warm = options?.warm ?? false;
  const voiceId = clara ? CLARA_VOICE_ID : VOICE_ID;
  const voice_settings = clara
    ? { stability: 0.48, similarity_boost: 0.86, style: 0.45, use_speaker_boost: true, speed: 0.76 }
    : warm
      ? { stability: 0.4, similarity_boost: 0.88, style: 0.6, use_speaker_boost: true, speed: 0.94 }
      : { stability: 0.55, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true };

  const payload = { text, model_id: modelId, voice_settings };

  if (usesApiProxy()) {
    try {
      const blob = await proxyPostBlob('/api/elevenlabs/tts', {
        voiceId,
        ...payload,
      });
      if (!blob.size) throw new Error('Proxy returned empty audio');
      return blob;
    } catch (err) {
      console.warn('ElevenLabs proxy failed, trying direct API:', err);
      if (!ELEVENLABS_API_KEY?.trim()) throw err;
    }
  }

  const res = await fetch(`${ELEVENLABS_BASE}/text-to-speech/${voiceId}`, {
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

async function playAudioBlob(blob: Blob, gen: number): Promise<void> {
  if (gen !== speakGeneration) return;

  const url = URL.createObjectURL(blob);

  await new Promise<void>((resolve, reject) => {
    if (gen !== speakGeneration) {
      URL.revokeObjectURL(url);
      resolve();
      return;
    }

    const audio = new Audio(url);
    audio.setAttribute('playsinline', 'true');
    currentAudio = audio;

    const finish = () => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
      if (interruptPlayback === interrupt) interruptPlayback = null;
      resolve();
    };

    const fail = (err?: unknown) => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
      if (interruptPlayback === interrupt) interruptPlayback = null;
      reject(err instanceof Error ? err : new Error('Audio playback blocked'));
    };

    const interrupt = () => {
      audio.pause();
      audio.onended = null;
      audio.onerror = null;
      finish();
    };

    interruptPlayback = interrupt;
    audio.onended = finish;
    audio.onerror = () => fail(new Error('Audio element error'));
    void audio.play().catch(fail);
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

function pickClaraVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const prefer = ['Samantha', 'Karen', 'Serena', 'Moira', 'Victoria', 'Fiona', 'Allison'];
  for (const name of prefer) {
    const hit = voices.find((v) => v.lang.startsWith('en') && v.name.includes(name));
    if (hit) return hit;
  }
  return voices.find((v) => v.lang.startsWith('en-US')) ?? voices.find((v) => v.lang.startsWith('en'));
}

function pause(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function speakWithBrowserTTS(text: string): Promise<void> {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  await new Promise((r) => setTimeout(r, 100));

  const voices = await loadVoices();
  const preferred = pickClaraVoice(voices);

  const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text];
  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;
    await new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(sentence);
      utterance.lang = 'en-US';
      utterance.rate = CLARA_SPEECH_RATE;
      utterance.pitch = CLARA_SPEECH_PITCH;
      utterance.volume = CLARA_SPEECH_VOLUME;
      if (preferred) utterance.voice = preferred;
      const timer = setTimeout(resolve, Math.max(4000, sentence.length * 150));
      const done = () => { clearTimeout(timer); resolve(); };
      utterance.onend = done;
      utterance.onerror = done;
      window.speechSynthesis.speak(utterance);
    });
    await pause(CLARA_SENTENCE_PAUSE_MS);
  }
}

async function speakBrowser(text: string, gen: number, options?: SpeakOptions): Promise<void> {
  if (!('speechSynthesis' in window)) return;
  if (gen !== speakGeneration) return;

  console.log('[TTS] browser speechSynthesis:', text.slice(0, 40));

  const voices = await loadVoices();
  if (gen !== speakGeneration) return;

  window.speechSynthesis.cancel();
  await new Promise((r) => setTimeout(r, 100));
  if (gen !== speakGeneration) return;

  const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text];
  const preferred = pickClaraVoice(voices);

  let interrupted = false;
  const interrupt = () => {
    interrupted = true;
    window.speechSynthesis.cancel();
    if (interruptPlayback === interrupt) interruptPlayback = null;
  };
  interruptPlayback = interrupt;

  const keepAlive = isIOSDevice()
    ? window.setInterval(() => {
        if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      }, 1000)
    : null;

  const claraMode = options?.clara ?? false;

  try {
    for (let i = 0; i < sentences.length; i++) {
      if (interrupted || gen !== speakGeneration) break;
      const sentence = sentences[i].trim();
      if (!sentence) continue;

      await new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(sentence);
        utterance.rate = claraMode ? CLARA_SPEECH_RATE : options?.warm ? 0.78 : 0.85;
        utterance.pitch = claraMode ? CLARA_SPEECH_PITCH : 1.0;
        utterance.volume = CLARA_SPEECH_VOLUME;
        utterance.lang = 'en-US';
        if (preferred) utterance.voice = preferred;

        const maxMs = Math.max(4500, sentence.length * (claraMode ? 150 : 90));
        const timer = window.setTimeout(() => {
          console.warn('[TTS] utterance timeout, continuing');
          resolve();
        }, maxMs);

        const done = () => {
          clearTimeout(timer);
          resolve();
        };
        utterance.onend = done;
        utterance.onerror = done;
        window.speechSynthesis.speak(utterance);
      });

      if (claraMode && i < sentences.length - 1) {
        await pause(CLARA_SENTENCE_PAUSE_MS);
      }
    }
  } finally {
    if (keepAlive) clearInterval(keepAlive);
    if (interruptPlayback === interrupt) interruptPlayback = null;
  }
}
