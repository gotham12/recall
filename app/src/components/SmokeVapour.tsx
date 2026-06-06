import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

export default function SmokeVapour({ intensity = 1 }: { intensity?: number }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const layers = gsap.utils.toArray<HTMLElement>('.smoke-layer');
      layers.forEach((layer, i) => {
        gsap.to(layer, {
          x: `+=${30 + i * 12}`,
          y: `+=${-18 + i * 8}`,
          rotation: i % 2 === 0 ? 6 : -5,
          duration: 10 + i * 2,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
        });
        gsap.to(layer, {
          opacity: 0.12 * intensity + i * 0.04,
          duration: 6 + i,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
        });
      });
    },
    { scope: rootRef, dependencies: [intensity] }
  );

  return (
    <div ref={rootRef} className="smoke-root" aria-hidden>
      <div className="smoke-layer smoke-layer-1" />
      <div className="smoke-layer smoke-layer-2" />
      <div className="smoke-layer smoke-layer-3" />
      <div className="smoke-layer smoke-layer-4" />
    </div>
  );
}
