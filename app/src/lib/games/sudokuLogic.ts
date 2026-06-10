export type Grid = number[][];

const SOLUTION: Grid = [
  [5, 3, 4, 6, 7, 8, 9, 1, 2],
  [6, 7, 2, 1, 9, 5, 3, 4, 8],
  [1, 9, 8, 3, 4, 2, 5, 6, 7],
  [8, 5, 9, 7, 6, 1, 4, 2, 3],
  [4, 2, 6, 8, 5, 3, 7, 9, 1],
  [7, 1, 3, 9, 2, 4, 8, 5, 6],
  [9, 6, 1, 5, 3, 7, 2, 8, 4],
  [2, 8, 7, 4, 1, 9, 6, 3, 5],
  [3, 4, 5, 2, 8, 6, 1, 7, 9],
];

function cloneGrid(g: Grid): Grid {
  return g.map((row) => [...row]);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Permute rows/cols within bands for variety while keeping validity */
function transformSolution(seed: number): Grid {
  const g = cloneGrid(SOLUTION);
  const rng = (n: number) => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed % n;
  };

  for (let band = 0; band < 3; band++) {
    const rows = [0, 1, 2].map((i) => band * 3 + i);
    const perm = shuffle(rows);
    const temp = perm.map((r) => [...g[r]]);
    perm.forEach((r, i) => { g[r] = temp[i]; });
  }

  for (let c = 0; c < 9; c++) {
    const map = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (let r = 0; r < 9; r++) g[r][c] = map[g[r][c] - 1];
  }

  void rng;
  return g;
}

export function dailyPuzzle(date = new Date()): { puzzle: Grid; solution: Grid } {
  const key = date.toISOString().slice(0, 10);
  let seed = 0;
  for (let i = 0; i < key.length; i++) seed = seed * 31 + key.charCodeAt(i);

  const solution = transformSolution(seed);
  const puzzle = cloneGrid(solution);

  const cells = shuffle(
    Array.from({ length: 81 }, (_, i) => ({ r: Math.floor(i / 9), c: i % 9 }))
  );

  let removed = 0;
  const target = 44;
  for (const { r, c } of cells) {
    if (removed >= target) break;
    puzzle[r][c] = 0;
    removed++;
  }

  return { puzzle, solution };
}

export function isValidPlacement(grid: Grid, row: number, col: number, val: number): boolean {
  if (val === 0) return true;
  for (let c = 0; c < 9; c++) if (c !== col && grid[row][c] === val) return false;
  for (let r = 0; r < 9; r++) if (r !== row && grid[r][col] === val) return false;
  const br = Math.floor(row / 3) * 3;
  const bc = Math.floor(col / 3) * 3;
  for (let r = br; r < br + 3; r++) {
    for (let c = bc; c < bc + 3; c++) {
      if ((r !== row || c !== col) && grid[r][c] === val) return false;
    }
  }
  return true;
}

export function gridsEqual(a: Grid, b: Grid): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (a[r][c] !== b[r][c]) return false;
    }
  }
  return true;
}

export function isComplete(grid: Grid): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0 || !isValidPlacement(grid, r, c, grid[r][c])) return false;
    }
  }
  return true;
}
