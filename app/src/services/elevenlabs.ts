import { ELEVENLABS_API_KEY } from '../env';
import { proxyPostBlob, usesApiProxy, warnDirectApiKeys } from './apiClient';

const VOICE_ID = 'EXAVITQu4vr4xnSDxMaL';
const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';
const MODEL_ID = 'eleven_flash_v2_5';

let currentAudio: HTMLAudioElement | null = null;

export function isElevenLabsConfigured(): boolean {
  return usesApiProxy() || Boolean(ELEVENLABS_API_KEY?.trim());
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
  stopSpeaking();

  if (!isElevenLabsConfigured()) {
    console.warn('ElevenLabs API key missing — using browser TTS');
    await speakBrowser(text);
    return;
  }

  try {
    await speakElevenLabs(text);
  } catch (err) {
    console.warn('ElevenLabs TTS failed, falling back to browser TTS:', err);
    await speakBrowser(text);
  }
}

async function speakElevenLabs(text: string): Promise<void> {
  warnDirectApiKeys();

  let blob: Blob;

  if (usesApiProxy()) {
    blob = await proxyPostBlob('/api/elevenlabs/tts', {
      text,
      voiceId: VOICE_ID,
      model_id: MODEL_ID,
      voice_settings: {
        stability: 0.55,
        similarity_boost: 0.8,
        style: 0.25,
        use_speaker_boost: true,
      },
    });
  } else {
    const res = await fetch(`${ELEVENLABS_BASE}/text-to-speech/${VOICE_ID}`, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        voice_settings: {
          stability: 0.55,
          similarity_boost: 0.8,
          style: 0.25,
          use_speaker_boost: true,
        },
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`ElevenLabs ${res.status}${detail ? `: ${detail.slice(0, 120)}` : ''}`);
    }
    blob = await res.blob();
  }

  if (!blob.size) throw new Error('ElevenLabs returned empty audio');

  const url = URL.createObjectURL(blob);

  await new Promise<void>((resolve, reject) => {
    const audio = new Audio(url);
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
    audio.play().catch(reject);
  });
}

function speakBrowser(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      resolve();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.85;
    utterance.pitch = 1.05;
    utterance.volume = 1;

    const voices = window.speechSynthesis.getVoices();
    const femaleVoice = voices.find(
      (v) =>
        v.lang.startsWith('en') &&
        (v.name.includes('Samantha') ||
          v.name.includes('Karen') ||
          v.name.includes('Victoria') ||
          v.name.toLowerCase().includes('female'))
    );
    if (femaleVoice) utterance.voice = femaleVoice;

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();

    window.speechSynthesis.speak(utterance);
  });
}
