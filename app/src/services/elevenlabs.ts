import { ELEVENLABS_API_KEY } from '../env';
import { proxyPostBlob, usesApiProxy, warnDirectApiKeys } from './apiClient';
import { isNativeIOS, preparePlaybackForScreenRecord, releaseMicAfterClara } from '../lib/iosAudioSession';

/** Rachel — clear, warm American voice */
const VOICE_ID = 'EXAVITQu4vr4xnSDxMaL';
/** Jessica — expressive companion voice for Clara */
const CLARA_VOICE_ID = 'cgSgspJ2msm6clMCkdW9';
const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';
const MODEL_IDS = ['eleven_turbo_v2_5', 'eleven_flash_v2_5'];
const CLARA_MODEL_IDS = ['eleven_multilingual_v2', 'eleven_flash_v2_5', 'eleven_turbo_v2_5'];

let currentAudio: HTMLAudioElement | null = null;
let sharedAudioCtx: AudioContext | null = null;
let voicesReady: Promise<SpeechSynthesisVoice[]> | null = null;
let speakGeneration = 0;
let interruptPlayback: (() => void) | null = null;
let speakChain: Promise<void> = Promise.resolve();

function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export interface SpeakOptions {
  warm?: boolean;
  clara?: boolean;
}

export function isElevenLabsConfigured(): boolean {
  return usesApiProxy() || Boolean(ELEVENLABS_API_KEY?.trim());
}

export function primeSpeechSynthesis(): void {
  unlockAudioPlayback();
}

export function unlockAudioPlayback(): void {
  if (isNativeIOS()) {
    void preparePlaybackForScreenRecord();
    return;
  }

  try {
    const silent = new Audio(
      'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'
    );
    silent.volume = 0.01;
    void silent.play().then(() => silent.pause()).catch(() => {});
  } catch { /* ignore */ }

  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx) {
      if (!sharedAudioCtx) sharedAudioCtx = new Ctx();
      void sharedAudioCtx.resume();
    }
  } catch { /* ignore */ }
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
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  if (isNativeIOS()) {
    void releaseMicAfterClara();
  }
}

export async function speak(text: string, options?: SpeakOptions): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;

  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const prev = speakChain;
  speakChain = gate;
  await prev;

  try {
    stopSpeaking();
    const myGen = speakGeneration;

    if (isElevenLabsConfigured()) {
      try {
        await speakElevenLabs(trimmed, myGen, options);
        return;
      } catch (err) {
        console.warn('[TTS] ElevenLabs failed:', err);
      }
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
      await playBlob(blob, gen);
      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError ?? new Error('ElevenLabs TTS failed');
}

function claraVoiceSettings(clara: boolean, warm: boolean) {
  if (clara) {
    return { stability: 0.35, similarity_boost: 0.92, style: 0.68, use_speaker_boost: true, speed: 1.02 };
  }
  if (warm) {
    return { stability: 0.42, similarity_boost: 0.88, style: 0.5, use_speaker_boost: true, speed: 0.98 };
  }
  return { stability: 0.5, similarity_boost: 0.82, style: 0.3, use_speaker_boost: true };
}

async function fetchElevenLabsAudio(text: string, modelId: string, options?: SpeakOptions): Promise<Blob> {
  const clara = options?.clara ?? false;
  const warm = options?.warm ?? false;
  const voiceId = clara ? CLARA_VOICE_ID : VOICE_ID;
  const voice_settings = claraVoiceSettings(clara, warm);
  const payload = { text, model_id: modelId, voice_settings };

  // 1️⃣ Direct ElevenLabs — bypasses proxy MeloTTS bug
  const apiKey = ELEVENLABS_API_KEY?.trim();
  if (apiKey) {
    try {
      const res = await fetch(`${ELEVENLABS_BASE}/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const blob = await res.blob();
        if (blob.size > 500) return blob;
      } else if (res.status === 401 || res.status === 403) {
        const detail = await res.text().catch(() => '');
        throw new Error(`ElevenLabs ${res.status}: ${detail.slice(0, 80)}`);
      } else {
        const detail = await res.text().catch(() => '');
        console.warn('[TTS] Direct ElevenLabs failed:', res.status, detail.slice(0, 80));
      }
    } catch (err) {
      console.warn('[TTS] Direct ElevenLabs threw:', err);
    }
  }

  // 2️⃣ Proxy ElevenLabs (reject MeloTTS WAV masquerading as TTS)
  if (usesApiProxy()) {
    const blob = await proxyPostBlob('/api/elevenlabs/tts', { voiceId, ...payload });
    if (!blob.size) throw new Error('Proxy returned empty audio');
    return blob;
  }

  throw new Error('No ElevenLabs API key or proxy');
}

/** Play via Web Audio on iOS (reliable); HTML Audio elsewhere */
async function playBlob(blob: Blob, gen: number): Promise<void> {
  if (isIOSDevice()) {
    await playAudioBlobWebAudio(blob, gen);
    return;
  }
  try {
    await playAudioBlob(blob, gen);
  } catch {
    await playAudioBlobWebAudio(blob, gen);
  }
}

async function playAudioBlob(blob: Blob, gen: number): Promise<void> {
  if (gen !== speakGeneration) return;
  const url = URL.createObjectURL(blob);

  await new Promise<void>((resolve, reject) => {
    if (gen !== speakGeneration) { URL.revokeObjectURL(url); resolve(); return; }

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
    const interrupt = () => { audio.pause(); audio.onended = null; audio.onerror = null; finish(); };

    interruptPlayback = interrupt;
    audio.onended = finish;
    audio.onerror = () => fail(new Error('Audio element error'));
    void audio.play().catch(fail);
  });
}

async function playAudioBlobWebAudio(blob: Blob, gen: number): Promise<void> {
  if (gen !== speakGeneration) return;

  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) throw new Error('Web Audio not available');

  if (!sharedAudioCtx) sharedAudioCtx = new Ctx();
  const ctx = sharedAudioCtx;
  await ctx.resume();

  const arrayBuffer = await blob.arrayBuffer();
  const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
  if (gen !== speakGeneration) return;

  await new Promise<void>((resolve, reject) => {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = 1.0;
    source.connect(gain);
    gain.connect(ctx.destination);

    const finish = () => {
      if (interruptPlayback === interrupt) interruptPlayback = null;
      resolve();
    };
    const interrupt = () => {
      try { source.stop(); } catch { /* stopped */ }
      finish();
    };
    interruptPlayback = interrupt;
    source.onended = finish;
    try {
      source.start(0);
    } catch (err) {
      reject(err instanceof Error ? err : new Error('Web Audio start failed'));
    }
  });
}

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!('speechSynthesis' in window)) return Promise.resolve([]);
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

export async function speakWithBrowserTTS(text: string): Promise<void> {
  await speakBrowser(text, speakGeneration, { clara: true });
}

async function speakBrowser(text: string, gen: number, options?: SpeakOptions): Promise<void> {
  if (!('speechSynthesis' in window)) return;
  if (gen !== speakGeneration) return;

  console.warn('[TTS] Using browser voice fallback — ElevenLabs unavailable');

  const voices = await loadVoices();
  if (gen !== speakGeneration) return;

  window.speechSynthesis.cancel();
  await new Promise((r) => setTimeout(r, 80));

  const preferred =
    voices.find((v) => v.name.includes('Samantha') && v.lang.startsWith('en')) ??
    voices.find((v) => v.lang.startsWith('en-US'));

  const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text];
  let interrupted = false;
  const interrupt = () => {
    interrupted = true;
    window.speechSynthesis.cancel();
    if (interruptPlayback === interrupt) interruptPlayback = null;
  };
  interruptPlayback = interrupt;

  try {
    for (const raw of sentences) {
      if (interrupted || gen !== speakGeneration) break;
      const sentence = raw.trim();
      if (!sentence) continue;

      await new Promise<void>((resolve) => {
        const u = new SpeechSynthesisUtterance(sentence);
        u.lang = 'en-US';
        u.rate = 1.0;
        u.pitch = 1.1;
        u.volume = 1;
        if (preferred) u.voice = preferred;
        const timer = setTimeout(resolve, Math.max(4000, sentence.length * 70));
        const done = () => { clearTimeout(timer); resolve(); };
        u.onend = done;
        u.onerror = done;
        window.speechSynthesis.speak(u);
      });
    }
  } finally {
    if (interruptPlayback === interrupt) interruptPlayback = null;
  }
}
