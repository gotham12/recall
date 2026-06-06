import { useRef, useEffect } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import SmokeVapour from './SmokeVapour';

interface FlowerStageProps {
  src: string;
  className?: string;
  glowIntensity?: number;
  variant?: 'hero' | 'app';
}

export default function FlowerStage({
  src,
  className = '',
  glowIntensity = 1,
  variant = 'hero',
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
          ? { opacity: 0, scale: 0.94, filter: 'blur(8px) brightness(1.2)' }
          : { opacity: 0, scale: 0.96 },
        {
          opacity: 1,
          scale: 1,
          filter: 'blur(0px) brightness(1.05)',
          duration: isSwap ? 1.2 : 0.9,
          ease: 'power3.out',
        }
      );

      gsap.to(imgRef.current, {
        scale: 1.008,
        duration: 6,
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
    <div ref={rootRef} className={`flower-stage flower-stage--${variant} ${className}`}>
      <div className="flower-image-frame">
        <div
          className="flower-glow"
          style={{ opacity: 0.35 * glowIntensity }}
        />
        <div className="flower-glow flower-glow--inner" style={{ opacity: 0.2 * glowIntensity }} />
        <SmokeVapour intensity={glowIntensity * 0.7} />
        <img
          ref={imgRef}
          src={src}
          alt=""
          className="flower-image"
          draggable={false}
        />
      </div>
      <div className="flower-vignette" />
      <div className="flower-letterbox flower-letterbox--top" />
      <div className="flower-letterbox flower-letterbox--bottom" />
    </div>
  );
}
