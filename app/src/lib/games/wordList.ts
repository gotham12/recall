import { isDictionaryWord } from './wordDict';

/** Curated 5-letter words — familiar, positive, dementia-friendly vocabulary */
export const WORDLE_WORDS = [
  'HEART', 'PEACE', 'HAPPY', 'SMILE', 'BLOOM', 'SWEET', 'GRACE', 'LIGHT',
  'DREAM', 'PEARL', 'BREAD', 'CHAIR', 'CLEAN', 'CLOUD', 'DANCE', 'EARTH',
  'FRESH', 'FRUIT', 'GLASS', 'GREEN', 'HOUSE', 'LAUGH', 'LEMON', 'MUSIC',
  'OCEAN', 'PAINT', 'PEACH', 'PLANT', 'QUIET', 'RADIO', 'RIVER', 'SHINE',
  'SLEEP', 'SPARK', 'STORY', 'SUNNY', 'TABLE', 'TULIP', 'WATER', 'WHEEL',
  'WOMAN', 'YOUTH', 'ANGEL', 'BEACH', 'BERRY', 'BIRDS', 'BLOSS', 'CANDY',
  'CARES', 'CHARM', 'CHEER', 'CROWN', 'DAISY', 'FAITH', 'FLAME', 'FLOWER',
].filter((w) => w.length === 5);

export function isValidGuess(word: string): boolean {
  return /^[A-Za-z]{5}$/.test(word) && isDictionaryWord(word);
}

export { isDictionaryWord };

/** Only answers that are also accepted guesses — guarantees every day is winnable. */
const PLAYABLE_WORDS = WORDLE_WORDS.filter((w) => isDictionaryWord(w));

function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dailyWord(date = new Date()): string {
  const pool = PLAYABLE_WORDS.length > 0 ? PLAYABLE_WORDS : WORDLE_WORDS;
  const key = localDateKey(date);
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return pool[hash % pool.length];
}

export type LetterState = 'correct' | 'present' | 'absent' | 'empty';

export function scoreGuess(guess: string, answer: string): LetterState[] {
  const g = guess.toUpperCase();
  const a = answer.toUpperCase();
  const result: LetterState[] = Array(5).fill('absent');
  const answerChars = a.split('');
  const used = Array(5).fill(false);

  for (let i = 0; i < 5; i++) {
    if (g[i] === a[i]) {
      result[i] = 'correct';
      used[i] = true;
    }
  }
  for (let i = 0; i < 5; i++) {
    if (result[i] === 'correct') continue;
    const idx = answerChars.findIndex((c, j) => !used[j] && c === g[i]);
    if (idx >= 0) {
      result[i] = 'present';
      used[idx] = true;
    }
  }
  return result;
}
