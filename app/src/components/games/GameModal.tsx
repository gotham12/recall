import type { ReactNode } from 'react';
import StudioIcon from '../StudioIcon';

interface GameModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}

export default function GameModal({ title, subtitle, onClose, children }: GameModalProps) {
  return (
    <div className="game-modal" role="dialog" aria-label={title}>
      <div className="game-modal__backdrop" onClick={onClose} aria-hidden />
      <div className="game-modal__panel card">
        <header className="game-modal__header">
          <div>
            <h2 className="game-modal__title">{title}</h2>
            {subtitle && <p className="game-modal__subtitle">{subtitle}</p>}
          </div>
          <button type="button" className="studio-icon-btn tap-feedback" onClick={onClose} aria-label="Close">
            <StudioIcon name="close" size={20} />
          </button>
        </header>
        <div className="game-modal__body">{children}</div>
      </div>
    </div>
  );
}
