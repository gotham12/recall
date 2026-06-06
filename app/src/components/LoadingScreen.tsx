import { useEffect, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useAppStore } from '../store/appStore';
import FlowerStage from './FlowerStage';
import { FLOWERS } from '../flowers';

export default function LoadingScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const contentRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.from('.splash-wordmark', {
        opacity: 0,
        y: 18,
        duration: 1,
        ease: 'power2.out',
        delay: 0.4,
      });
      gsap.from('.splash-tagline', {
        opacity: 0,
        y: 10,
        duration: 0.9,
        ease: 'power2.out',
        delay: 0.7,
      });
    },
    { scope: contentRef }
  );

  useEffect(() => {
    const timer = setTimeout(() => setScreen('login'), 2200);
    return () => clearTimeout(timer);
  }, [setScreen]);

  return (
    <div className="studio-screen splash-screen">
      <FlowerStage src={FLOWERS.splash} glowIntensity={1.2} />
      <div ref={contentRef} className="studio-overlay splash-overlay">
        <h1 className="splash-wordmark">Recall</h1>
        <p className="splash-tagline">Cognitive Care</p>
      </div>
    </div>
  );
}
