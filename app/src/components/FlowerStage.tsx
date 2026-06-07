import { useRef, useEffect } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import SmokeVapour from './SmokeVapour';
import { duration, EASE, prefersReducedMotion } from '../lib/motion';

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
  const frameRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const layerARef = useRef<HTMLImageElement>(null);
  const layerBRef = useRef<HTMLImageElement>(null);
  const activeLayer = useRef<'a' | 'b'>('a');
  const displayedSrc = useRef(src);
  const breatheTween = useRef<gsap.core.Tween | null>(null);
  const glowTween = useRef<gsap.core.Tween | null>(null);
  const hasEntered = useRef(false);

  const targetOpacity = variant === 'app' ? 0.78 : 1;

  const pauseAnimations = () => {
    breatheTween.current?.pause();
    glowTween.current?.pause();
  };

  const resumeAnimations = () => {
    if (document.hidden) return;
    breatheTween.current?.resume();
    glowTween.current?.resume();
  };

  useGSAP(
    () => {
      if (!layerARef.current || !frameRef.current) return;

      gsap.set([layerARef.current, layerBRef.current], { force3D: true });

      if (!hasEntered.current) {
        hasEntered.current = true;
        gsap.fromTo(
          layerARef.current,
          { opacity: 0, scale: 0.97, filter: 'blur(8px)' },
          {
            opacity: targetOpacity,
            scale: 1,
            filter: 'blur(0px)',
            duration: duration(1.5),
            ease: EASE.soft,
          }
        );
      }

      breatheTween.current?.kill();
      glowTween.current?.kill();

      if (!prefersReducedMotion()) {
        breatheTween.current = gsap.to(frameRef.current, {
          scale: 1.003,
          duration: 10,
          ease: EASE.breathe,
          repeat: -1,
          yoyo: true,
          transformOrigin: '50% 88%',
        });

        if (glowRef.current) {
          glowTween.current = gsap.to(glowRef.current, {
            opacity: 0.38 * glowIntensity,
            duration: 5,
            ease: EASE.breathe,
            repeat: -1,
            yoyo: true,
          });
        }
      }
    },
    { scope: rootRef, dependencies: [variant, glowIntensity] }
  );

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) pauseAnimations();
      else resumeAnimations();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    if (src === displayedSrc.current) return;

    const outgoing =
      activeLayer.current === 'a' ? layerARef.current : layerBRef.current;
    const incoming =
      activeLayer.current === 'a' ? layerBRef.current : layerARef.current;
    if (!outgoing || !incoming) return;

    const img = new Image();
    img.onload = () => {
      incoming.src = src;
      displayedSrc.current = src;

      if (prefersReducedMotion()) {
        gsap.set(outgoing, { opacity: 0 });
        gsap.set(incoming, { opacity: targetOpacity, scale: 1, filter: 'none' });
        activeLayer.current = activeLayer.current === 'a' ? 'b' : 'a';
        return;
      }

      const tl = gsap.timeline({ defaults: { ease: EASE.crossfade } });
      tl.set(incoming, {
        opacity: 0,
        scale: 1.014,
        filter: 'blur(6px)',
        zIndex: 2,
      })
        .set(outgoing, { zIndex: 1 })
        .to(
          outgoing,
          {
            opacity: 0,
            scale: 0.99,
            filter: 'blur(4px)',
            duration: duration(1.3),
          },
          0
        )
        .to(
          incoming,
          {
            opacity: targetOpacity,
            scale: 1,
            filter: 'blur(0px)',
            duration: duration(1.6),
          },
          0.18
        )
        .set(outgoing, { scale: 1, filter: 'none', zIndex: 0 })
        .call(() => {
          activeLayer.current = activeLayer.current === 'a' ? 'b' : 'a';
        });
    };
    img.src = src;
  }, [src, targetOpacity]);

  return (
    <div ref={rootRef} className={`flower-stage flower-stage--${variant} ${className}`}>
      <div ref={frameRef} className="flower-image-frame">
        <div
          ref={glowRef}
          className="flower-glow"
          style={{ opacity: 0.3 * glowIntensity }}
        />
        <div className="flower-glow flower-glow--inner" style={{ opacity: 0.18 * glowIntensity }} />
        {variant === 'hero' && <SmokeVapour intensity={glowIntensity * 0.65} />}
        <div className="flower-images">
          <img
            ref={layerARef}
            src={src}
            alt=""
            className="flower-image flower-image--layer"
            draggable={false}
          />
          <img
            ref={layerBRef}
            alt=""
            className="flower-image flower-image--layer"
            draggable={false}
            style={{ opacity: 0 }}
          />
        </div>
      </div>
      <div className="flower-vignette" />
    </div>
  );
}
