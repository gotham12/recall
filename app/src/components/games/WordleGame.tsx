import { useCallback, useEffect, useState } from 'react';
import {
  dailyWord,
  scoreGuess,
  WORDLE_GUESSES,
  type LetterState,
} from '../../lib/games/wordList';

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
  const [keyStates, setKeyStates] = useState<Record<string, LetterState>>({});

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
    if (current.length !== 5) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    if (!WORDLE_GUESSES.includes(current)) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    const scores = scoreGuess(current, answer);
    updateKeyStates(current, scores);
    const next = [...guesses, current];
    setGuesses(next);
    setCurrent('');
    if (current === answer) {
      setStatus('won');
      onComplete?.();
    } else if (next.length >= ROWS) {
      setStatus('lost');
    }
  }, [current, answer, guesses, updateKeyStates, onComplete]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (status !== 'playing') return;
      if (e.key === 'Enter') submit();
      else if (e.key === 'Backspace') setCurrent((c) => c.slice(0, -1));
      else if (/^[a-zA-Z]$/.test(e.key) && current.length < 5) {
        setCurrent((c) => (c + e.key.toUpperCase()).slice(0, 5));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, status, submit]);

  const rows = Array.from({ length: ROWS }, (_, i) => {
    const guess = guesses[i] ?? (i === guesses.length ? current : '');
    const scores = guesses[i] ? scoreGuess(guesses[i], answer) : null;
    return { guess, scores, active: i === guesses.length };
  });

  return (
    <div className="wordle-game">
      <p className="wordle-game__hint">Guess the 5-letter word in {ROWS} tries</p>

      <div className={`wordle-board ${shake ? 'wordle-board--shake' : ''}`}>
        {rows.map((row, ri) => (
          <div key={ri} className="wordle-board__row">
            {Array.from({ length: COLS }, (_, ci) => {
              const letter = row.guess[ci] ?? '';
              const state = row.scores?.[ci] ?? (letter ? 'empty' : 'empty');
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
                  else if (current.length < 5) setCurrent((c) => c + key);
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
