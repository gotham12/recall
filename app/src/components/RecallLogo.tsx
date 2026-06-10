import ForgetMeNotMark from './ForgetMeNotMark';

interface RecallLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showMark?: boolean;
  className?: string;
}

export default function RecallLogo({ size = 'md', showMark = true, className = '' }: RecallLogoProps) {
  const titleSize = size === 'lg' ? 38 : size === 'sm' ? 18 : 24;
  const iconSize = size === 'lg' ? 44 : size === 'sm' ? 28 : 36;

  return (
    <div className={`recall-logo recall-logo--${size} ${className}`}>
      {showMark && (
        <span className="recall-logo__mark" aria-hidden>
          <ForgetMeNotMark size={iconSize} />
        </span>
      )}
      <span className="recall-logo__word" style={{ fontSize: titleSize }}>Recall</span>
    </div>
  );
}
