const KEY      = (import.meta.env.VITE_ELEVENLABS_API_KEY as string) || 'sk_d36c8525b450a193b58231b83a2f2d89a99965a3433c931d';
const VOICE_ID = 'XrExE9yKIg1WjnnlVkGX'; // Matilda — warm female
const BASE     = 'https://api.elevenlabs.io/v1';

let currentAudio: HTMLAudioElement | null = null;
let currentSource: AudioBufferSourceNode | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let audioCtx: AudioContext | null = null;
let audioUnlocked = false;

// Called directly inside a user-gesture handler (tap/click).
// Plays a silent byte to permanently unlock iOS audio session for this page.
export function unlockAudio(): void {
  if (audioUnlocked) return;
  try {
    // 1. Unlock via silent Audio element (most reliable for iOS Safari)
    const silent = new Audio(
      'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'
    );
    silent.play().catch(() => {});

    // 2. Also create/resume an AudioContext for the WebAudio path
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AC = window.AudioContext ?? (window as any).webkitAudioContext;
    if (AC) {
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    }

    audioUnlocked = true;
  } catch { /* non-critical */ }
}

export function stopSpeaking(): void {
  if (currentSource) { try { currentSource.stop(); } catch { /* already stopped */ } currentSource = null; }
  if (currentAudio)  { currentAudio.pause(); currentAudio.src = ''; currentAudio = null; }
}

export async function speak(text: string): Promise<void> {
  if (!text.trim()) return;
  stopSpeaking();
  await speakElevenLabs(text);
}

async function speakElevenLabs(text: string): Promise<void> {
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

    // Path 1: Web Audio API (bypasses iOS async-gesture restriction)
    if (audioCtx) {
      try {
        if (audioCtx.state === 'suspended') await audioCtx.resume();
        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        await new Promise<void>((resolve) => {
          const source = audioCtx!.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioCtx!.destination);
          currentSource = source;
          source.onended = () => { currentSource = null; resolve(); };
          source.start();
          setTimeout(resolve, (audioBuffer.duration + 3) * 1000);
        });
        return;
      } catch (ctxErr) {
        console.warn('[ElevenLabs] AudioContext path failed, trying Audio element:', ctxErr);
      }
    }

    // Path 2: Standard Audio element fallback
    const url = URL.createObjectURL(blob);
    await new Promise<void>((resolve, reject) => {
      const audio = new Audio(url);
      audio.setAttribute('playsinline', '');
      currentAudio = audio;
      audio.onended  = () => { URL.revokeObjectURL(url); currentAudio = null; resolve(); };
      audio.onerror  = () => { URL.revokeObjectURL(url); reject(new Error('Audio playback failed')); };
      audio.play().catch(reject);
    });
    return;
  }

  throw new Error(lastError || 'All ElevenLabs models failed');
}
