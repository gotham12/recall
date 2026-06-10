/** Curated 5-letter words — familiar, positive, dementia-friendly vocabulary */
export const WORDLE_WORDS = [
  'HEART', 'PEACE', 'HAPPY', 'SMILE', 'BLOOM', 'SWEET', 'GRACE', 'LIGHT',
  'DREAM', 'PEARL', 'BREAD', 'CHAIR', 'CLEAN', 'CLOUD', 'DANCE', 'EARTH',
  'FRESH', 'FRUIT', 'GLASS', 'GREEN', 'HOUSE', 'LAUGH', 'LEMON', 'MUSIC',
  'OCEAN', 'PAINT', 'PEACH', 'PLANT', 'QUIET', 'RADIO', 'RIVER', 'SHINE',
  'SLEEP', 'SPARK', 'STORY', 'SUNNY', 'TABLE', 'TULIP', 'WATER', 'WHEEL',
  'WOMAN', 'YOUTH', 'ANGEL', 'BEACH', 'BERRY', 'BIRDS', 'BLOSS', 'CANDY',
  'CARES', 'CHARM', 'CHEER', 'CROWN', 'DAISY', 'FAITH', 'FAMILY', 'FLAME',
].filter((w) => w.length === 5);

export const WORDLE_GUESSES = [
  ...WORDLE_WORDS,
  'ABOUT', 'AFTER', 'AGAIN', 'BEING', 'COULD', 'EVERY', 'GREAT', 'LITTLE',
  'NEVER', 'OTHER', 'PLACE', 'RIGHT', 'SHALL', 'STILL', 'THEIR', 'THERE',
  'THING', 'THINK', 'THREE', 'UNDER', 'WHERE', 'WHICH', 'WHILE', 'WORLD',
  'WOULD', 'WRITE', 'YEARS', 'ALONG', 'BEGAN', 'BENCH', 'BIRTH', 'BREAK',
  'BRING', 'BUILD', 'CARRY', 'CAUSE', 'CHILD', 'CLASS', 'CLOSE', 'COLOR',
  'COMES', 'COVER', 'CROSS', 'DAILY', 'DOING', 'DOORS', 'EARLY', 'ENTER',
  'FIELD', 'FINAL', 'FIRST', 'FLOOR', 'FOCUS', 'FORCE', 'FOUND', 'FRAME',
  'FRONT', 'GIVEN', 'GOING', 'GROUP', 'GUESS', 'HANDS', 'HAPPY', 'HORSE',
];

export function dailyWord(date = new Date()): string {
  const key = date.toISOString().slice(0, 10);
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return WORDLE_WORDS[hash % WORDLE_WORDS.length];
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
