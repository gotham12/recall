const KEY     = import.meta.env.VITE_ELEVENLABS_API_KEY as string;
const VOICE_ID = 'XrExE9yKIg1WjnnlVkGX'; // Matilda — warm female
const BASE     = 'https://api.elevenlabs.io/v1';

let currentAudio: HTMLAudioElement | null = null;

export function stopSpeaking(): void {
  if (currentAudio) { currentAudio.pause(); currentAudio.src = ''; currentAudio = null; }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

export async function speak(text: string): Promise<void> {
  if (!text.trim()) return;
  stopSpeaking();
  await speakElevenLabs(text);
}

async function speakElevenLabs(text: string): Promise<void> {
  // Try flash model first (faster, cheaper), fall back to turbo
  const models = ['eleven_flash_v2_5', 'eleven_turbo_v2_5', 'eleven_multilingual_v2'];

  let lastError = '';
  for (const model_id of models) {
    const res = await fetch(`${BASE}/text-to-speech/${VOICE_ID}`, {
      method: 'POST',
      headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        model_id,
        voice_settings: { stability: 0.4, similarity_boost: 0.75, style: 0.1, use_speaker_boost: true },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      lastError = `ElevenLabs ${res.status}: ${body}`;
      console.warn(`[ElevenLabs] model ${model_id} failed —`, lastError);
      continue;
    }

    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    await new Promise<void>((resolve, reject) => {
      const audio = new Audio(url);
      currentAudio = audio;
      audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
      audio.onerror = (e) => { URL.revokeObjectURL(url); reject(new Error(`Audio playback failed: ${e}`)); };
      audio.play().catch(reject);
    });
    return; // success
  }

  throw new Error(lastError || 'All ElevenLabs models failed');
}

