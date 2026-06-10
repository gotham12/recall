export interface ConnectionGroup {
  category: string;
  words: string[];
  difficulty: 1 | 2 | 3 | 4;
}

export const CONNECTIONS_PUZZLES: ConnectionGroup[][] = [
  [
    { category: 'Things in Margaret\'s garden', words: ['ROSES', 'TULIPS', 'HERBS', 'BENCH'], difficulty: 1 },
    { category: 'Sunday dinner foods', words: ['BREAD', 'SALAD', 'PIE', 'SOUP'], difficulty: 2 },
    { category: 'Family members', words: ['SUSAN', 'ROBERT', 'MARGARET', 'LILY'], difficulty: 3 },
    { category: 'Maple Lane rooms', words: ['PORCH', 'KITCHEN', 'BEDROOM', 'GARDEN'], difficulty: 4 },
  ],
  [
    { category: 'Morning routine', words: ['BRUSH', 'WASH', 'DRESS', 'EAT'], difficulty: 1 },
    { category: 'Chess pieces', words: ['KING', 'QUEEN', 'ROOK', 'PAWN'], difficulty: 2 },
    { category: 'Seasons', words: ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'], difficulty: 3 },
    { category: 'Types of memory', words: ['EPISODIC', 'SEMANTIC', 'WORKING', 'PROCEDURAL'], difficulty: 4 },
  ],
  [
    { category: 'Colors in the garden', words: ['RED', 'PINK', 'GOLD', 'GREEN'], difficulty: 1 },
    { category: 'Kitchen items', words: ['MUG', 'POT', 'PAN', 'BOWL'], difficulty: 2 },
    { category: 'Porch activities', words: ['READ', 'CHAT', 'REST', 'WATCH'], difficulty: 3 },
    { category: 'Medication times', words: ['MORNING', 'NOON', 'EVENING', 'NIGHT'], difficulty: 4 },
  ],
];

export function dailyConnections(date = new Date()): ConnectionGroup[] {
  const key = date.toISOString().slice(0, 10);
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return CONNECTIONS_PUZZLES[hash % CONNECTIONS_PUZZLES.length];
}

export const DIFFICULTY_COLORS: Record<number, string> = {
  1: '#F9DF6D',
  2: '#A0C35A',
  3: '#B0C4EF',
  4: '#BA81C5',
};
