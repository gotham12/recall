import { useCallback, useRef, useState } from 'react';

type SpeechRecognitionResult = {
  isFinal: boolean;
  [index: number]: { transcript: string; confidence?: number };
};

type SpeechRecognitionEvent = {
  results: SpeechRecognitionResult[];
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

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

const LISTEN_MAX_MS = 12_000;
const SILENCE_AFTER_SPEECH_MS = 1_800;

function collectTranscript(results: SpeechRecognitionResult[]): string {
  let text = '';
  for (let i = 0; i < results.length; i++) {
    if (results[i].isFinal) {
      text += results[i][0].transcript;
    }
  }
  return text.trim();
}

export function useVoice() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const stopListening = useCallback(() => {
    clearTimers();
    recognitionRef.current?.stop();
    setIsListening(false);
  }, [clearTimers]);

  const startListening = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
      if (!SR) {
        reject(new Error('Speech recognition not supported'));
        return;
      }

      recognitionRef.current?.abort();
      clearTimers();

      const recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;
      recognitionRef.current = recognition;

      let settled = false;
      let finalText = '';
      let silenceTimer: ReturnType<typeof setTimeout> | null = null;
      let heardSpeech = false;

      const finish = (text: string) => {
        if (settled) return;
        settled = true;
        clearTimers();
        if (silenceTimer) clearTimeout(silenceTimer);
        setIsListening(false);
        setTranscript(text);
        resolve(text);
      };

      const scheduleSilenceStop = () => {
        if (silenceTimer) clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => {
          recognition.stop();
        }, SILENCE_AFTER_SPEECH_MS);
      };

      recognition.onresult = (e: SpeechRecognitionEvent) => {
        const finals = collectTranscript(e.results);
        if (finals) {
          finalText = finals;
          heardSpeech = true;
        }

        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (!e.results[i].isFinal) {
            interim += e.results[i][0].transcript;
          }
        }

        setTranscript((finalText + interim).trim());

        if (heardSpeech) {
          scheduleSilenceStop();
        }
      };

      recognition.onspeechstart = () => {
        heardSpeech = true;
      };

      recognition.onspeechend = () => {
        scheduleSilenceStop();
      };

      recognition.onerror = (e: { error: string }) => {
        if (settled) return;
        // Soft errors — resolve with whatever we captured
        if (e.error === 'no-speech' || e.error === 'aborted') {
          recognition.stop();
          return;
        }
        settled = true;
        clearTimers();
        setIsListening(false);
        reject(new Error(e.error));
      };

      recognition.onend = () => {
        if (settled) return;
        finish(finalText);
      };

      timersRef.current.push(
        setTimeout(() => {
          recognition.stop();
        }, LISTEN_MAX_MS)
      );

      setIsListening(true);
      setTranscript('');
      try {
        recognition.start();
      } catch {
        settled = true;
        setIsListening(false);
        reject(new Error('Could not start microphone'));
      }
    });
  }, [clearTimers]);

  return { isListening, transcript, startListening, stopListening };
}
