import { useCallback, useEffect, useRef, useState } from 'react';
import {
  dailyWord,
  isDictionaryWord,
  scoreGuess,
  type LetterState,
} from '../../lib/games/wordList';
import { useAppStore } from '../../store/appStore';

const INVALID_WARNINGS = [
  'Not in word list',
  "Oops — that isn't a real word",
  'Please enter a real word',
  'Try a word you know',
] as const;
const INVALID_CASCADE_THRESHOLD = 4;

const ROWS = 6;
const COLS = 5;
const KEYS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫'],
];

interface WordleGameProps {
  onComplete?: () => void;
}

export default function WordleGame({ onComplete }: WordleGameProps) {
  const answer = dailyWord();
  const [guesses, setGuesses] = useState<string[]>([]);
  const [current, setCurrent] = useState('');
  const [status, setStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const [shake, setShake] = useState(false);
  const [toast, setToast] = useState('');
  const [invalidAttempts, setInvalidAttempts] = useState(0);
  const [keyStates, setKeyStates] = useState<Record<string, LetterState>>({});
  const deductAcse = useAppStore((s) => s.deductAcse);
  const guessesRef = useRef(guesses);
  guessesRef.current = guesses;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 1800);
  };

  const updateKeyStates = useCallback((guess: string, scores: LetterState[]) => {
    setKeyStates((prev) => {
      const next = { ...prev };
      for (let i = 0; i < 5; i++) {
        const letter = guess[i];
        const score = scores[i];
        const existing = next[letter];
        if (score === 'correct' || (score === 'present' && existing !== 'correct')) {
          next[letter] = score;
        } else if (!existing || existing === 'absent') {
          next[letter] = score;
        }
      }
      return next;
    });
  }, []);

  const submit = useCallback(() => {
    if (status !== 'playing') return;

    const word = current.trim().toUpperCase();
    if (word.length !== 5) {
      setShake(true);
      showToast('Need 5 letters');
      setTimeout(() => setShake(false), 500);
      return;
    }
    if (!/^[A-Za-z]{5}$/.test(word)) {
      setShake(true);
      showToast('Not enough letters');
      setTimeout(() => setShake(false), 500);
      return;
    }
    if (!isDictionaryWord(word)) {
      setShake(true);
      const nextInvalid = invalidAttempts + 1;
      setInvalidAttempts(nextInvalid);
      const msg = INVALID_WARNINGS[Math.min(nextInvalid - 1, INVALID_WARNINGS.length - 1)];
      showToast(msg);
      setTimeout(() => setShake(false), 500);

      if (nextInvalid >= INVALID_CASCADE_THRESHOLD) {
        const score = useAppStore.getState().acseScore;
        const drop = Math.max(35, score - 40);
        deductAcse(drop, 'Repeated invalid words in Daily Word puzzle', 'semantic_loop');
        setInvalidAttempts(0);
      }
      return;
    }

    const scores = scoreGuess(word, answer);
    updateKeyStates(word, scores);
    const nextGuesses = [...guessesRef.current, word];
    setGuesses(nextGuesses);
    setCurrent('');

    if (word === answer) {
      setStatus('won');
      onComplete?.();
    } else if (nextGuesses.length >= ROWS) {
      setStatus('lost');
    }
  }, [current, answer, status, updateKeyStates, onComplete, invalidAttempts, deductAcse]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (status !== 'playing') return;
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      } else if (e.key === 'Backspace') {
        setCurrent((c) => c.slice(0, -1));
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        setCurrent((c) => (c.length < 5 ? c + e.key.toUpperCase() : c));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [status, submit]);

  const activeRow = guesses.length;

  const rows = Array.from({ length: ROWS }, (_, i) => {
    const guess = guesses[i] ?? (i === activeRow ? current : '');
    const scores = guesses[i] ? scoreGuess(guesses[i], answer) : null;
    return { guess, scores, active: i === activeRow };
  });

  return (
    <div className="wordle-game">
      <p className="wordle-game__hint">Guess the 5-letter word in {ROWS} tries</p>
      {toast && <p className="wordle-game__toast" role="status">{toast}</p>}

      <div className={`wordle-board ${shake ? 'wordle-board--shake' : ''}`}>
        {rows.map((row, ri) => (
          <div key={ri} className="wordle-board__row">
            {Array.from({ length: COLS }, (_, ci) => {
              const letter = row.guess[ci] ?? '';
              const state = row.scores?.[ci] ?? 'empty';
              const filled = !!letter;
              const reveal = !!row.scores;
              return (
                <div
                  key={ci}
                  className={`wordle-tile wordle-tile--${reveal ? state : filled ? 'filled' : 'empty'} ${row.active && ci === row.guess.length ? 'wordle-tile--cursor' : ''}`}
                >
                  {letter}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {status === 'won' && (
        <p className="wordle-game__result wordle-game__result--win">Beautiful! You found it — {answer}</p>
      )}
      {status === 'lost' && (
        <p className="wordle-game__result wordle-game__result--lose">The word was {answer}. Try again tomorrow!</p>
      )}

      <div className="wordle-keyboard">
        {KEYS.map((row, ri) => (
          <div key={ri} className="wordle-keyboard__row">
            {row.map((key) => (
              <button
                key={key}
                type="button"
                className={`wordle-key tap-feedback ${key.length > 1 ? 'wordle-key--wide' : ''} ${keyStates[key] ? `wordle-key--${keyStates[key]}` : ''}`}
                onClick={() => {
                  if (status !== 'playing') return;
                  if (key === 'ENTER') submit();
                  else if (key === '⌫') setCurrent((c) => c.slice(0, -1));
                  else setCurrent((c) => (c.length < 5 ? c + key : c));
                }}
              >
                {key}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
