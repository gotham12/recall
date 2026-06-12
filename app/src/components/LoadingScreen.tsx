import { useEffect, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useAppStore } from '../store/appStore';
import { duration } from '../lib/motion';

const LETTERS = ['R', 'E', 'C', 'A', 'L', 'L'];

// Left branch: SVG angles clockwise from bottom through left to top
const LEFT_ANGLES  = [97, 111, 125, 139, 153, 167, 181, 195, 209, 223, 237, 251, 265];
// Right branch: counterclockwise from bottom through right to top (mirror)
const RIGHT_ANGLES = [83, 69, 55, 41, 27, 13, 359, 345, 331, 317, 303, 289, 275];

const WR = 108;   // wreath radius
const WC = 150;   // wreath center

export default function LoadingScreen() {
  const setScreen  = useAppStore(s => s.setScreen);
  const screenRef  = useRef<HTMLDivElement>(null);
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useGSAP(() => {
    const tl = gsap.timeline();

    // Entrance — CSS handles all continuous effects; GSAP only for one-shot entrance
    tl.from('.sl-orb-rose', { scale: 0, opacity: 0, duration: duration(1.8), ease: 'power3.out' }, 0);
    tl.from('.sl-orb-blue', { scale: 0, opacity: 0, duration: duration(1.8), ease: 'power3.out' }, 0.2);

    tl.from('.sl-wreath-wrap', {
      scale: 0.5, opacity: 0,
      duration: duration(1.0), ease: 'back.out(1.4)',
    }, 0.15);

    tl.from(letterRefs.current.filter(Boolean), {
      y: 70, opacity: 0, scale: 0.4, rotationX: 90,
      duration: duration(0.75), stagger: 0.07,
      ease: 'elastic.out(1, 0.58)',
      transformOrigin: 'center bottom',
    }, 0.55);

    tl.from('.sl-subtitle', {
      y: 16, opacity: 0, duration: duration(0.6), ease: 'power3.out',
    }, 1.05);

    tl.from('.sl-tag', {
      y: 12, opacity: 0, scale: 0.9,
      duration: duration(0.45), stagger: 0.09, ease: 'back.out(2)',
    }, 1.25);

  }, { scope: screenRef });

  useEffect(() => {
    const DISPLAY_MS = 2800;
    const EXIT_MS    = 550;

    const exitTimer = setTimeout(() => {
      const letters = letterRefs.current.filter(Boolean);
      gsap.to(letters, { y: -70, opacity: 0, stagger: 0.04, duration: duration(0.4), ease: 'power3.in' });
      gsap.to('.sl-wreath-wrap', { scale: 0, opacity: 0, duration: duration(0.4), ease: 'back.in(1.5)', delay: 0.05 });
      gsap.to('.sl-subtitle, .sl-tags', { opacity: 0, duration: duration(0.3) });
      if (screenRef.current) gsap.to(screenRef.current, { opacity: 0, duration: duration(0.5), delay: 0.15 });
    }, DISPLAY_MS);

    const loginTimer = setTimeout(() => setScreen('login'), DISPLAY_MS + EXIT_MS);

    return () => { clearTimeout(exitTimer); clearTimeout(loginTimer); };
  }, [setScreen]);

  return (
    <div ref={screenRef} className="sl-screen" aria-label="Loading Recall">
      {/* Aurora blobs — CSS animated only (no GSAP infinite loops) */}
      <div className="sl-orb sl-orb-rose" aria-hidden />
      <div className="sl-orb sl-orb-blue"  aria-hidden />

      {/* Laurel wreath + orb */}
      <div className="sl-wreath-wrap" aria-hidden>
        {/* Pulsating golden orb — CSS animated */}
        <div className="sl-orb-center">
          <div className="sl-orb-glow"  />
          <div className="sl-orb-core"  />
          <div className="sl-orb-swirl" />
          <div className="sl-orb-shine" />
        </div>

        {/* Laurel SVG — purely static gold, no animation */}
        <svg
          viewBox="0 0 300 300"
          width="240" height="240"
          className="sl-wreath-svg"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="lgLeaf" cx="50%" cy="25%" r="75%">
              <stop offset="0%"   stopColor="#FFE87A" />
              <stop offset="45%"  stopColor="#FFC107" />
              <stop offset="100%" stopColor="#6B3E00" />
            </radialGradient>
            <radialGradient id="lgRibbon" cx="50%" cy="20%" r="80%">
              <stop offset="0%"   stopColor="#FFD700" />
              <stop offset="100%" stopColor="#7A4D00" />
            </radialGradient>
          </defs>

          {/* Left branch */}
          {LEFT_ANGLES.map((angle, i) => {
            const rad = (angle * Math.PI) / 180;
            const x   = WC + WR * Math.cos(rad);
            const y   = WC + WR * Math.sin(rad);
            return (
              <ellipse
                key={`L${i}`}
                cx={x} cy={y} rx={6} ry={21}
                fill="url(#lgLeaf)"
                opacity={0.93}
                transform={`rotate(${angle + 90}, ${x}, ${y})`}
              />
            );
          })}

          {/* Right branch */}
          {RIGHT_ANGLES.map((angle, i) => {
            const rad = (angle * Math.PI) / 180;
            const x   = WC + WR * Math.cos(rad);
            const y   = WC + WR * Math.sin(rad);
            return (
              <ellipse
                key={`R${i}`}
                cx={x} cy={y} rx={6} ry={21}
                fill="url(#lgLeaf)"
                opacity={0.93}
                transform={`rotate(${angle - 90}, ${x}, ${y})`}
              />
            );
          })}

          {/* Ribbon bow */}
          <g transform="translate(150, 254)">
            <ellipse cx="-15" cy="2" rx="15" ry="7" fill="url(#lgRibbon)"
                     transform="rotate(-25, -15, 2)" opacity="0.95"/>
            <ellipse cx="15"  cy="2" rx="15" ry="7" fill="url(#lgRibbon)"
                     transform="rotate(25, 15, 2)"  opacity="0.95"/>
            <ellipse cx="0"   cy="0" rx="8"  ry="8" fill="url(#lgRibbon)" opacity="1"/>
          </g>
        </svg>
      </div>

      {/* RECALL */}
      <div className="sl-title" aria-label="Recall">
        {LETTERS.map((l, i) => (
          <span key={i} ref={el => { letterRefs.current[i] = el; }} className="sl-letter">{l}</span>
        ))}
      </div>

      <p className="sl-subtitle">Memory · Medication · Moments</p>

      <div className="sl-tags" aria-hidden>
        {['Dementia Care', 'AI Companion', 'Family Connected'].map(t => (
          <span key={t} className="sl-tag">{t}</span>
        ))}
      </div>
    </div>
  );
}
