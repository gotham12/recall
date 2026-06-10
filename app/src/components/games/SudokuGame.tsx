import { useCallback, useMemo, useState } from 'react';
import {
  dailyPuzzle,
  isComplete,
  isValidPlacement,
  type Grid,
} from '../../lib/games/sudokuLogic';

interface SudokuGameProps {
  onComplete?: () => void;
}

export default function SudokuGame({ onComplete }: SudokuGameProps) {
  const { puzzle: initial, solution } = useMemo(() => dailyPuzzle(), []);
  const fixed = useMemo(() => initial.map((row) => row.map((v) => v !== 0)), [initial]);
  const [grid, setGrid] = useState<Grid>(() => initial.map((row) => [...row]));
  const [selected, setSelected] = useState<{ r: number; c: number } | null>(null);
  const [errors, setErrors] = useState<Set<string>>(new Set());
  const [won, setWon] = useState(false);

  const setCell = useCallback((r: number, c: number, val: number) => {
    if (fixed[r][c] || won) return;
    setGrid((g) => {
      const next = g.map((row) => [...row]);
      next[r][c] = val;
      const err = new Set<string>();
      for (let rr = 0; rr < 9; rr++) {
        for (let cc = 0; cc < 9; cc++) {
          if (next[rr][cc] !== 0 && !isValidPlacement(next, rr, cc, next[rr][cc])) {
            err.add(`${rr}-${cc}`);
          }
        }
      }
      setErrors(err);
      if (isComplete(next) && err.size === 0) {
        setWon(true);
        onComplete?.();
      }
      return next;
    });
  }, [fixed, won, onComplete]);

  const highlight = useMemo(() => {
    if (!selected) return new Set<string>();
    const s = new Set<string>();
    const val = grid[selected.r][selected.c];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (r === selected.r || c === selected.c) s.add(`${r}-${c}`);
        if (val && grid[r][c] === val) s.add(`${r}-${c}`);
      }
    }
    const br = Math.floor(selected.r / 3) * 3;
    const bc = Math.floor(selected.c / 3) * 3;
    for (let r = br; r < br + 3; r++) {
      for (let c = bc; c < bc + 3; c++) s.add(`${r}-${c}`);
    }
    return s;
  }, [selected, grid]);

  return (
    <div className="sudoku-game">
      <p className="sudoku-game__hint">Fill every row, column, and 3×3 box with digits 1–9</p>

      <div className="sudoku-board">
        {grid.map((row, r) => (
          <div key={r} className="sudoku-board__row">
            {row.map((val, c) => {
              const key = `${r}-${c}`;
              const isFixed = fixed[r][c];
              const isSelected = selected?.r === r && selected?.c === c;
              const isError = errors.has(key);
              const isHl = highlight.has(key);
              return (
                <button
                  key={c}
                  type="button"
                  className={`sudoku-cell ${isFixed ? 'sudoku-cell--fixed' : ''} ${isSelected ? 'sudoku-cell--selected' : ''} ${isHl ? 'sudoku-cell--highlight' : ''} ${isError ? 'sudoku-cell--error' : ''} ${(c + 1) % 3 === 0 && c < 8 ? 'sudoku-cell--border-r' : ''} ${(r + 1) % 3 === 0 && r < 8 ? 'sudoku-cell--border-b' : ''}`}
                  onClick={() => setSelected({ r, c })}
                  disabled={isFixed}
                >
                  {val || ''}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {!won && selected && !fixed[selected.r][selected.c] && (
        <div className="sudoku-numpad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button
              key={n}
              type="button"
              className="sudoku-numpad__key tap-feedback"
              onClick={() => setCell(selected.r, selected.c, n)}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            className="sudoku-numpad__key sudoku-numpad__key--clear tap-feedback"
            onClick={() => setCell(selected.r, selected.c, 0)}
          >
            Clear
          </button>
        </div>
      )}

      {won && <p className="sudoku-game__win">Puzzle complete — wonderful work!</p>}

      <button
        type="button"
        className="studio-btn studio-btn--ghost tap-feedback sudoku-game__hint-btn"
        onClick={() => {
          if (!selected || fixed[selected.r][selected.c]) return;
          setCell(selected.r, selected.c, solution[selected.r][selected.c]);
        }}
      >
        Hint (one cell)
      </button>
    </div>
  );
}
