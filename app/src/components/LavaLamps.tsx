/**
 * Pure-CSS lava-lamp blobs. Zero JS, GPU-composited.
 * Positioned absolutely to fill the parent (use parent position:relative).
 */
export default function LavaLamps({ opacity = 0.22 }: { opacity?: number }) {
  const blobs = [
    { size: 180, top: '5%',  left: '-8%', color: '#2196F3', anim: 'lava1', delay: '0s' },
    { size: 140, top: '15%', right: '-5%', color: '#0057CC', anim: 'lava2', delay: '-4s' },
    { size: 120, top: '40%', left: '-6%', color: '#60B3FF', anim: 'lava3', delay: '-8s' },
    { size: 160, top: '55%', right: '-8%', color: '#0E7AE6', anim: 'lava4', delay: '-2s' },
    { size: 100, top: '75%', left: '2%',  color: '#A8D8FF', anim: 'lava5', delay: '-6s' },
    { size: 130, top: '80%', right: '-4%', color: '#2196F3', anim: 'lava6', delay: '-10s' },
  ];

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      {blobs.map((b, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: b.size,
            height: b.size,
            top: b.top,
            left: 'left' in b ? b.left : undefined,
            right: 'right' in b ? b.right : undefined,
            borderRadius: '50%',
            background: b.color,
            filter: 'blur(42px)',
            opacity,
            animation: `${b.anim} ${getAnimDuration(b.anim)} ease-in-out infinite`,
            animationDelay: b.delay,
            willChange: 'transform',
          }}
        />
      ))}
    </div>
  );
}

function getAnimDuration(name: string) {
  const map: Record<string, string> = {
    lava1: '14s', lava2: '18s', lava3: '22s',
    lava4: '16s', lava5: '20s', lava6: '12s',
  };
  return map[name] ?? '16s';
}
