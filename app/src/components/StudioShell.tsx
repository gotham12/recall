import { ReactNode, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import FlowerStage from './FlowerStage';
import AnimatedPanel from './AnimatedPanel';
import { FLOWERS } from '../flowers';
import { duration, EASE } from '../lib/motion';

interface StudioShellProps {
  children: ReactNode;
  flowerSrc?: string;
  contentKey?: string;
  header?: ReactNode;
  footer?: ReactNode;
  dimOverlay?: number;
}

export default function StudioShell({
  children,
  flowerSrc = FLOWERS.home,
  contentKey,
  header,
  footer,
  dimOverlay = 0.58,
}: StudioShellProps) {
  const scrimRef = useRef<HTMLDivElement>(null);
  const prevFlower = useRef(flowerSrc);

  useGSAP(
    () => {
      if (flowerSrc === prevFlower.current) return;
      prevFlower.current = flowerSrc;

      if (scrimRef.current) {
        gsap.fromTo(
          scrimRef.current,
          { opacity: 0.92 },
          { opacity: 1, duration: duration(0.8), ease: EASE.smooth }
        );
      }
    },
    { dependencies: [flowerSrc] }
  );

  return (
    <div className="studio-screen studio-app">
      <FlowerStage src={flowerSrc} glowIntensity={0.75} variant="app" />
      <div
        ref={scrimRef}
        className="studio-app-scrim"
        style={{
          background: `linear-gradient(180deg,
            rgba(248,244,236,${dimOverlay + 0.12}) 0%,
            rgba(239,232,219,${dimOverlay}) 38%,
            rgba(248,244,236,${dimOverlay + 0.08}) 100%)`,
        }}
      />
      {header}
      <AnimatedPanel panelKey={contentKey ?? flowerSrc} className="studio-app-content">
        {children}
      </AnimatedPanel>
      {footer}
    </div>
  );
}
