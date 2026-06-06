import { useEffect, useRef, useCallback } from 'react';

interface ScrollImageSequenceProps {
  images: string[];      // up to 65 image src strings (URL or data URL)
  frameHeight?: number;  // px height of the visible viewport (default 500)
  className?: string;
  children?: React.ReactNode; // overlay content (e.g. LavaLamps)
}

/**
 * Scroll-driven image sequence.
 *
 * - Internal scrollable area (not window scroll)
 * - Instant frame swap with no CSS transitions
 * - Passive scroll listener for 60fps performance
 * - All frames preloaded into hidden <img> tags to prevent decode stutter
 * - Direct DOM mutation for the frame display (bypasses React re-render on scroll)
 */
export default function ScrollImageSequence({
  images,
  frameHeight = 500,
  className = '',
  children,
}: ScrollImageSequenceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const displayRef = useRef<HTMLImageElement>(null);
  const frameIndexRef = useRef(0);
  const framesRef = useRef<HTMLImageElement[]>([]);

  const clamp = (v: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, v));

  // Preload all frames into hidden <img> elements
  useEffect(() => {
    if (!images.length) return;

    const preloaded: HTMLImageElement[] = images.map((src) => {
      const img = new Image();
      img.src = src;
      img.decoding = 'async';
      return img;
    });
    framesRef.current = preloaded;

    // Show first frame
    if (displayRef.current && preloaded[0]) {
      displayRef.current.src = preloaded[0].src;
    }

    return () => {
      framesRef.current = [];
    };
  }, [images]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    const img = displayRef.current;
    if (!el || !img || !framesRef.current.length) return;

    const scrollTop = el.scrollTop;
    // Map scroll 0 → (totalHeight - frameHeight) to frame 0 → (n-1)
    const total = framesRef.current.length;
    const maxScroll = frameHeight * (total - 1);
    const progress = clamp(scrollTop / maxScroll, 0, 1);
    const newIndex = clamp(Math.floor(progress * (total - 1)), 0, total - 1);

    if (newIndex !== frameIndexRef.current) {
      frameIndexRef.current = newIndex;
      // Direct DOM mutation — no React state, no re-render
      const frame = framesRef.current[newIndex];
      if (frame?.src) img.src = frame.src;
    }
  }, [frameHeight]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Total scroll height: one viewport height per frame
  const spacerHeight = frameHeight * Math.max(1, images.length);

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ height: frameHeight, width: '100%' }}
    >
      {/* Sticky image display */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          width: '100%',
          height: frameHeight,
          pointerEvents: 'none',
        }}
      >
        <img
          ref={displayRef}
          alt="frame"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
            willChange: 'contents',
          }}
        />
        {/* Overlay slot */}
        {children && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
            }}
          >
            {children}
          </div>
        )}
      </div>

      {/* Internal scroll driver — sits on top, transparent */}
      <div
        ref={containerRef}
        className="scroll-seq-container"
        style={{
          position: 'absolute',
          inset: 0,
          overflowY: 'scroll',
          WebkitOverflowScrolling: 'touch' as const,
          overscrollBehavior: 'contain',
          zIndex: 10,
        }}
      >
        <div style={{ height: spacerHeight, width: '100%', opacity: 0 }} />
      </div>
    </div>
  );
}
