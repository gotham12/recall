import { ELEVENLABS_API_KEY } from '../env';

const VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // Bella — warm female voice (Matilda: XrExE9yKIg1WjnnlVkGX)
const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';

let currentAudio: HTMLAudioElement | null = null;

export function stopSpeaking(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = '';
    currentAudio = null;
  }
  // Also stop browser TTS
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export async function speak(text: string): Promise<void> {
  stopSpeaking();

  try {
    await speakElevenLabs(text);
  } catch (err) {
    console.warn('ElevenLabs TTS failed, falling back to browser TTS:', err);
    await speakBrowser(text);
  }
}

async function speakElevenLabs(text: string): Promise<void> {
  const res = await fetch(`${ELEVENLABS_BASE}/text-to-speech/${VOICE_ID}`, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_monolingual_v1',
      voice_settings: {
        stability: 0.6,
        similarity_boost: 0.75,
        style: 0.3,
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`ElevenLabs ${res.status}`);
  }

  const blob = await res.blob();
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

    // Pick a female voice if available
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
