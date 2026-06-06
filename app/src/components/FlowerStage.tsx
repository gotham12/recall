import { useRef, useEffect } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import SmokeVapour from './SmokeVapour';

interface FlowerStageProps {
  src: string;
  className?: string;
  glowIntensity?: number;
}

export default function FlowerStage({
  src,
  className = '',
  glowIntensity = 1,
}: FlowerStageProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const prevSrc = useRef(src);

  useGSAP(
    () => {
      if (!imgRef.current) return;

      const isSwap = prevSrc.current !== src;
      if (isSwap) prevSrc.current = src;

      gsap.fromTo(
        imgRef.current,
        isSwap
          ? { opacity: 0, scale: 1.06, filter: 'blur(14px) brightness(1.35)' }
          : { opacity: 0, scale: 1.04 },
        {
          opacity: 1,
          scale: 1,
          filter: 'blur(0px) brightness(1.12)',
          duration: isSwap ? 1.35 : 1.1,
          ease: 'power3.out',
        }
      );

      gsap.to(imgRef.current, {
        scale: 1.015,
        duration: 5,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
      });
    },
    { scope: rootRef, dependencies: [src], revertOnUpdate: true }
  );

  useEffect(() => {
    const img = new Image();
    img.src = src;
  }, [src]);

  return (
    <div ref={rootRef} className={`flower-stage ${className}`}>
      <div
        className="flower-glow"
        style={{ opacity: 0.55 * glowIntensity }}
      />
      <div className="flower-glow flower-glow--inner" style={{ opacity: 0.35 * glowIntensity }} />
      <SmokeVapour intensity={glowIntensity} />
      <img
        ref={imgRef}
        src={src}
        alt=""
        className="flower-image"
        draggable={false}
      />
      <div className="flower-vignette" />
    </div>
  );
}
