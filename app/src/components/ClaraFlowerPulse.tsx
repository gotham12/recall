/** Clara's response indicator — rose bloom pulses when active */

interface ClaraFlowerPulseProps {
  active: boolean;
  size?: number;
  className?: string;
}

const PETAL_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

export default function ClaraFlowerPulse({ active, size = 96, className = '' }: ClaraFlowerPulseProps) {
  return (
    <div
      className={`clara-flower-pulse ${active ? 'clara-flower-pulse--active' : ''} ${className}`}
      style={{ width: size, height: size }}
      aria-hidden={!active}
      aria-label={active ? 'Clara is responding' : undefined}
      role={active ? 'status' : undefined}
    >
      <span className="clara-flower-pulse__stem" />
      <span className="clara-flower-pulse__center" />
      {PETAL_ANGLES.map((angle, i) => (
        <span
          key={angle}
          className="clara-flower-pulse__petal"
          style={{
            ['--petal-angle' as string]: `${angle}deg`,
            ['--petal-delay' as string]: `${i * 0.18}s`,
          }}
        />
      ))}
    </div>
  );
}
