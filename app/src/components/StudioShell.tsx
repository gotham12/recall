import { ReactNode } from 'react';
import FlowerStage from './FlowerStage';
import { FLOWERS } from '../flowers';

interface StudioShellProps {
  children: ReactNode;
  flowerSrc?: string;
  header?: ReactNode;
  footer?: ReactNode;
  dimOverlay?: number;
}

export default function StudioShell({
  children,
  flowerSrc = FLOWERS.home,
  header,
  footer,
  dimOverlay = 0.82,
}: StudioShellProps) {
  return (
    <div className="studio-screen studio-app">
      <FlowerStage src={flowerSrc} glowIntensity={0.6} variant="app" />
      <div
        className="studio-app-scrim"
        style={{ background: `linear-gradient(180deg, rgba(0,0,0,${dimOverlay + 0.06}) 0%, rgba(0,0,0,${dimOverlay}) 35%, rgba(0,0,0,${dimOverlay + 0.04}) 100%)` }}
      />
      {header}
      <div className="studio-app-content">{children}</div>
      {footer}
    </div>
  );
}
