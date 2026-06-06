import { useEffect, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useAppStore } from '../store/appStore';
import FlowerStage from './FlowerStage';
import RecallLogo from './RecallLogo';
import { FLOWERS } from '../flowers';
import { duration, EASE } from '../lib/motion';

export default function LoadingScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const screenRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: EASE.enter } });
      tl.from('.splash-wordmark', {
        opacity: 0,
        y: 20,
        duration: duration(1.1),
        delay: 0.35,
      }).from(
        '.splash-tagline',
        {
          opacity: 0,
          y: 12,
          duration: duration(0.9),
        },
        '-=0.5'
      );
    },
    { scope: contentRef }
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      const el = screenRef.current;
      if (!el) {
        setScreen('login');
        return;
      }
      gsap.to(el, {
        opacity: 0,
        filter: 'blur(4px)',
        duration: duration(0.85),
        ease: EASE.smooth,
        onComplete: () => setScreen('login'),
      });
    }, 2600);
    return () => clearTimeout(timer);
  }, [setScreen]);

  return (
    <div ref={screenRef} className="studio-screen splash-screen">
      <FlowerStage src={FLOWERS.splash} glowIntensity={1.2} variant="hero" />
      <div
        ref={contentRef}
        className="login-top splash-wordmark"
        style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, transparent 100%)' }}
      >
        <RecallLogo size="lg" />
        <p className="splash-tagline">Cognitive Care</p>
      </div>
    </div>
  );
}
