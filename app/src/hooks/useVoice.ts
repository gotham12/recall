import { useCallback, useRef, useState } from 'react';

type SpeechRecognitionEvent = {
  results: { [key: number]: { [key: number]: { transcript: string } } };
  resultIndex: number;
};

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

export function useVoice() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const startListening = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
      if (!SR) {
        reject(new Error('Speech recognition not supported'));
        return;
      }

      const recognition = new SR();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      recognitionRef.current = recognition;

      recognition.onresult = (e: SpeechRecognitionEvent) => {
        const text = e.results[e.resultIndex][0].transcript;
        setTranscript(text);
        resolve(text);
      };

      recognition.onerror = (e: { error: string }) => {
        setIsListening(false);
        reject(new Error(e.error));
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      setIsListening(true);
      recognition.start();
    });
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return { isListening, transcript, startListening, stopListening };
}
