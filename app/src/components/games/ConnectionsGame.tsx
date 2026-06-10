import { useMemo, useState } from 'react';
import {
  dailyConnections,
  DIFFICULTY_COLORS,
  type ConnectionGroup,
} from '../../lib/games/connectionsData';

const MAX_MISTAKES = 4;

interface ConnectionsGameProps {
  onComplete?: () => void;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function ConnectionsGame({ onComplete }: ConnectionsGameProps) {
  const groups = useMemo(() => dailyConnections(), []);
  const [pool, setPool] = useState(() => shuffle(groups.flatMap((g) => g.words)));
  const [selected, setSelected] = useState<string[]>([]);
  const [solved, setSolved] = useState<ConnectionGroup[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [shake, setShake] = useState(false);

  const toggle = (word: string) => {
    if (solved.some((g) => g.words.includes(word))) return;
    setSelected((prev) =>
      prev.includes(word) ? prev.filter((w) => w !== word) : prev.length < 4 ? [...prev, word] : prev
    );
  };

  const submit = () => {
    if (selected.length !== 4) return;
    const match = groups.find(
      (g) => !solved.includes(g) && g.words.every((w) => selected.includes(w))
    );
    if (match) {
      setSolved((s) => [...s, match]);
      setPool((p) => p.filter((w) => !selected.includes(w)));
      setSelected([]);
      if (solved.length + 1 === groups.length) onComplete?.();
    } else {
      setMistakes((m) => m + 1);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setSelected([]);
    }
  };

  const gameOver = mistakes >= MAX_MISTAKES;
  const won = solved.length === groups.length;

  return (
    <div className="connections-game">
      <p className="connections-game__hint">Find groups of four related words</p>
      <div className="connections-game__mistakes">
        {Array.from({ length: MAX_MISTAKES }, (_, i) => (
          <span key={i} className={`connections-mistake ${i < mistakes ? 'connections-mistake--used' : ''}`} />
        ))}
      </div>

      {solved.map((g) => (
        <div
          key={g.category}
          className="connections-solved"
          style={{ background: DIFFICULTY_COLORS[g.difficulty] }}
        >
          <p className="connections-solved__cat">{g.category}</p>
          <p className="connections-solved__words">{g.words.join(', ')}</p>
        </div>
      ))}

      {!won && !gameOver && (
        <div className={`connections-grid ${shake ? 'connections-grid--shake' : ''}`}>
          {pool.map((word) => (
            <button
              key={word}
              type="button"
              className={`connections-tile tap-feedback ${selected.includes(word) ? 'connections-tile--selected' : ''}`}
              onClick={() => toggle(word)}
            >
              {word}
            </button>
          ))}
        </div>
      )}

      {!won && !gameOver && (
        <div className="connections-actions">
          <button type="button" className="studio-btn studio-btn--ghost tap-feedback" onClick={() => setPool(shuffle([...pool]))}>
            Shuffle
          </button>
          <button
            type="button"
            className="studio-btn studio-btn--primary tap-feedback"
            disabled={selected.length !== 4}
            onClick={submit}
          >
            Submit
          </button>
        </div>
      )}

      {won && <p className="connections-game__win">All groups found — sharp thinking!</p>}
      {gameOver && !won && (
        <div className="connections-game__reveal">
          <p className="connections-game__lose">Out of mistakes — here are the groups:</p>
          {groups.filter((g) => !solved.includes(g)).map((g) => (
            <div key={g.category} className="connections-solved" style={{ background: DIFFICULTY_COLORS[g.difficulty] }}>
              <p className="connections-solved__cat">{g.category}</p>
              <p className="connections-solved__words">{g.words.join(', ')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
