import { useState, useCallback, useRef } from 'react';

const GROQ_KEY = (import.meta.env.VITE_GROQ_API_KEY as string) || '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';

export function useVoice() {
  const [isListening, setIsListening] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef        = useRef<Blob[]>([]);
  const streamRef        = useRef<MediaStream | null>(null);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsListening(false);
  }, []);

  // startListening: returns a Promise that resolves with the transcript string
  const startListening = useCallback((): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        // Pick the best supported MIME type
        const mimeType = ['audio/webm', 'audio/ogg', 'audio/mp4', '']
          .find(m => !m || MediaRecorder.isTypeSupported(m)) ?? '';

        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        mediaRecorderRef.current = recorder;
        chunksRef.current = [];

        recorder.ondataavailable = e => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = async () => {
          stream.getTracks().forEach(t => t.stop());
          streamRef.current = null;
          setIsListening(false);

          if (chunksRef.current.length === 0) {
            reject(new Error('No audio recorded.'));
            return;
          }

          const audioBlob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });

          // Send to Groq Whisper for transcription
          try {
            const form = new FormData();
            const ext  = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
            form.append('file', audioBlob, `audio.${ext}`);
            form.append('model', 'whisper-large-v3');
            form.append('language', 'en');

            const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
              method: 'POST',
              headers: { Authorization: `Bearer ${GROQ_KEY}` },
              body: form,
            });

            if (!res.ok) {
              const err = await res.text().catch(() => res.status.toString());
              reject(new Error(`Transcription failed: ${err}`));
              return;
            }

            const data = await res.json();
            const transcript = (data.text ?? '').trim();
            resolve(transcript);
          } catch (e) {
            reject(e);
          }
        };

        recorder.onerror = () => {
          reject(new Error('Recording error.'));
        };

        recorder.start();
        setIsListening(true);
      } catch (e: unknown) {
        setIsListening(false);
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('Permission') || msg.includes('denied') || msg.includes('NotAllowed')) {
          reject(new Error('Microphone access denied. Please allow microphone access and try again.'));
        } else {
          reject(new Error(`Microphone error: ${msg}`));
        }
      }
    });
  }, []);

  return { isListening, startListening, stopListening };
}
