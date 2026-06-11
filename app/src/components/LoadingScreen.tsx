import { useEffect, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useAppStore } from '../store/appStore';
import RecallLogo from './RecallLogo';
import { memoryPhotoUrl } from '../lib/memoryPhotos';
import { duration, EASE } from '../lib/motion';

export default function LoadingScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const screenRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.from('.splash-wordmark', {
        opacity: 0,
        y: 16,
        duration: duration(0.9),
        delay: 0.2,
        ease: EASE.enter,
      });
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
        duration: duration(0.6),
        ease: EASE.smooth,
        onComplete: () => setScreen('login'),
      });
    }, 2200);
    return () => clearTimeout(timer);
  }, [setScreen]);

  return (
    <div ref={screenRef} className="studio-screen splash-screen splash-screen--photo">
      <img src={memoryPhotoUrl('garden')} alt="" className="splash-screen__bg" />
      <div className="splash-screen__scrim" />

      <div ref={contentRef} className="splash-wordmark">
        <RecallLogo size="lg" />
      </div>

      <div className="splash-progress" aria-hidden>
        <div className="splash-progress__bar" />
      </div>
    </div>
  );
}
