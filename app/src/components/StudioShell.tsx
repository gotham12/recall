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
  dimOverlay = 0.72,
}: StudioShellProps) {
  return (
    <div className="studio-screen studio-app">
      <FlowerStage src={flowerSrc} glowIntensity={0.85} className="flower-stage--app" />
      <div
        className="studio-app-scrim"
        style={{ background: `rgba(0,0,0,${dimOverlay})` }}
      />
      {header}
      <div className="studio-app-content">{children}</div>
      {footer}
    </div>
  );
}
