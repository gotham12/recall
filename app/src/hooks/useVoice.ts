import { useState, useCallback, useRef } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SR = any;

export function useVoice() {
  const [isListening, setIsListening] = useState(false);
  const recRef = useRef<SR | null>(null);

  const stopListening = useCallback(() => {
    if (recRef.current) {
      recRef.current.abort();
      recRef.current = null;
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Stop any previous session
      if (recRef.current) {
        recRef.current.abort();
        recRef.current = null;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SRClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (!SRClass) {
        reject(new Error('Speech recognition is not supported in this browser. Try Chrome or Safari.'));
        return;
      }

      const rec: SR = new SRClass();
      rec.lang = 'en-US';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.continuous = false;

      recRef.current = rec;
      setIsListening(true);

      let resolved = false;

      rec.onresult = (e: SR) => {
        const transcript = e.results[0]?.[0]?.transcript?.trim() ?? '';
        if (!resolved) {
          resolved = true;
          recRef.current = null;
          setIsListening(false);
          resolve(transcript);
        }
      };

      rec.onerror = (e: SR) => {
        if (!resolved) {
          resolved = true;
          recRef.current = null;
          setIsListening(false);
          if (e.error === 'not-allowed') {
            reject(new Error('Microphone permission denied. Please allow microphone access and try again.'));
          } else if (e.error === 'no-speech') {
            reject(new Error('No speech detected. Please try again.'));
          } else if (e.error === 'aborted') {
            reject(new Error('aborted'));
          } else {
            reject(new Error(`Speech error: ${e.error}`));
          }
        }
      };

      // onend fires after onresult in Chrome — only reject if no result came
      rec.onend = () => {
        setIsListening(false);
        if (!resolved) {
          resolved = true;
          recRef.current = null;
          reject(new Error('No speech detected. Please try again.'));
        }
      };

      try {
        rec.start();
      } catch (err) {
        resolved = true;
        recRef.current = null;
        setIsListening(false);
        reject(err);
      }
    });
  }, []);

  return { isListening, startListening, stopListening };
}
