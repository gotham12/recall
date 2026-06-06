import StudioIcon from './StudioIcon';

interface RecallLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showMark?: boolean;
  className?: string;
}

export default function RecallLogo({ size = 'md', showMark = true, className = '' }: RecallLogoProps) {
  const titleSize = size === 'lg' ? 34 : size === 'sm' ? 16 : 22;
  const iconSize = size === 'lg' ? 28 : size === 'sm' ? 14 : 20;

  return (
    <div className={`recall-logo recall-logo--${size} ${className}`}>
      {showMark && (
        <span className="recall-logo__mark" aria-hidden>
          <StudioIcon name="flower" size={iconSize} strokeWidth={1.4} />
        </span>
      )}
      <span className="recall-logo__word" style={{ fontSize: titleSize }}>Recall</span>
    </div>
  );
}
