import { useState, type CSSProperties } from 'react';
import type { CognitiveGameId } from '../../db/db';
import StudioIcon from '../StudioIcon';
import GameModal from './GameModal';
import WordleGame from './WordleGame';
import SudokuGame from './SudokuGame';
import ConnectionsGame from './ConnectionsGame';

const GAMES: {
  id: CognitiveGameId;
  title: string;
  subtitle: string;
  emoji: string;
  gradient: string;
  benefits: string;
}[] = [
  {
    id: 'wordle',
    title: 'Daily Word',
    subtitle: 'Guess the five-letter word',
    emoji: 'W',
    gradient: 'linear-gradient(135deg, #6AAA64 0%, #538D4E 100%)',
    benefits: 'Word recall & language',
  },
  {
    id: 'sudoku',
    title: 'Sudoku',
    subtitle: 'Logic number puzzle',
    emoji: 'S',
    gradient: 'linear-gradient(135deg, #4A90D9 0%, #2E6BAD 100%)',
    benefits: 'Planning & focus',
  },
  {
    id: 'connections',
    title: 'Connections',
    subtitle: 'Group four related words',
    emoji: 'C',
    gradient: 'linear-gradient(135deg, #BA81C5 0%, #8B5FA8 100%)',
    benefits: 'Category thinking',
  },
];

interface GameHubProps {
  onGameComplete?: (gameId: CognitiveGameId) => void;
  compact?: boolean;
}

export default function GameHub({ onGameComplete, compact }: GameHubProps) {
  const [active, setActive] = useState<CognitiveGameId | null>(null);

  const handleComplete = (id: CognitiveGameId) => {
    onGameComplete?.(id);
  };

  const close = () => setActive(null);

  return (
    <>
      <section className={`mind-games ${compact ? 'mind-games--compact' : ''}`}>
        {!compact && (
          <div className="mind-games__hero">
            <StudioIcon name="brain" size={28} />
            <div>
              <h2 className="mind-games__title">Mind exercises</h2>
              <p className="mind-games__sub">Daily puzzles to keep your brain engaged</p>
            </div>
          </div>
        )}

        <div className="mind-games__grid">
          {GAMES.map((game) => (
            <button
              key={game.id}
              type="button"
              className="mind-game-card tap-feedback"
              style={{ '--game-gradient': game.gradient } as CSSProperties}
              onClick={() => setActive(game.id)}
            >
              <span className="mind-game-card__emoji">{game.emoji}</span>
              <div className="mind-game-card__body">
                <p className="mind-game-card__title">{game.title}</p>
                <p className="mind-game-card__sub">{game.subtitle}</p>
                <span className="mind-game-card__tag">{game.benefits}</span>
              </div>
              <span className="mind-game-card__play">Play</span>
            </button>
          ))}
        </div>
      </section>

      {active === 'wordle' && (
        <GameModal title="Daily Word" subtitle="A new word every morning" onClose={close}>
          <WordleGame onComplete={() => handleComplete('wordle')} />
        </GameModal>
      )}
      {active === 'sudoku' && (
        <GameModal title="Sudoku" subtitle="Today's puzzle" onClose={close}>
          <SudokuGame onComplete={() => handleComplete('sudoku')} />
        </GameModal>
      )}
      {active === 'connections' && (
        <GameModal title="Connections" subtitle="Find the four groups" onClose={close}>
          <ConnectionsGame onComplete={() => handleComplete('connections')} />
        </GameModal>
      )}
    </>
  );
}

/** Opens a specific game — used from routine checklist */
export function GameLauncher({
  gameId,
  onClose,
  onComplete,
}: {
  gameId: CognitiveGameId;
  onClose: () => void;
  onComplete?: () => void;
}) {
  const titles: Record<CognitiveGameId, string> = {
    wordle: 'Daily Word',
    sudoku: 'Sudoku',
    connections: 'Connections',
  };
  return (
    <GameModal title={titles[gameId]} onClose={onClose}>
      {gameId === 'wordle' && <WordleGame onComplete={onComplete} />}
      {gameId === 'sudoku' && <SudokuGame onComplete={onComplete} />}
      {gameId === 'connections' && <ConnectionsGame onComplete={onComplete} />}
    </GameModal>
  );
}
