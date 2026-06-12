import { useEffect, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useAppStore } from '../store/appStore';
import { duration } from '../lib/motion';

const LETTERS = ['R', 'E', 'C', 'A', 'L', 'L'];

// Outer branch — wider arc, larger leaves
const LEFT_ANGLES  = [97, 111, 125, 139, 153, 167, 181, 195, 209, 223, 237, 251, 265];
const RIGHT_ANGLES = [83, 69, 55, 41, 27, 13, 359, 345, 331, 317, 303, 289, 275];

// Inner branch — tighter radius, smaller leaves for depth
const LEFT_INNER   = [100, 116, 132, 148, 164, 180, 196, 212, 228, 244, 260];
const RIGHT_INNER  = [80,  64,  48,  32,  16, 360, 344, 328, 312, 296, 280];

// Berry cluster positions (angle → coord on outer ring)
const BERRY_ANGLES = [93, 139, 185, 231, 267, 87, 41, 355, 309, 273];

const WR = 110;   // outer wreath radius
const WI = 88;    // inner wreath radius
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
          {/* Texture: lava-crack web overlay */}
          <div className="sl-orb-cracks" />
          {/* Texture: fine noise stipple */}
          <div className="sl-orb-stipple" />
          <div className="sl-orb-swirl" />
          {/* Secondary counter-swirl for depth */}
          <div className="sl-orb-swirl2" />
          {/* Deep shadow rim */}
          <div className="sl-orb-rim" />
          {/* Primary highlight */}
          <div className="sl-orb-shine" />
          {/* Secondary micro-highlight */}
          <div className="sl-orb-shine2" />
        </div>

        {/* Laurel SVG — detailed gold engraving */}
        <svg
          viewBox="0 0 300 300"
          width="240" height="240"
          className="sl-wreath-svg"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Outer leaf: bright tip shading to dark base */}
            <radialGradient id="lgLeaf" cx="50%" cy="18%" r="80%">
              <stop offset="0%"   stopColor="#FFF5A0" />
              <stop offset="30%"  stopColor="#FFD000" />
              <stop offset="70%"  stopColor="#B87800" />
              <stop offset="100%" stopColor="#5C2E00" />
            </radialGradient>
            {/* Inner leaf: slightly darker for depth */}
            <radialGradient id="lgLeafInner" cx="50%" cy="22%" r="78%">
              <stop offset="0%"   stopColor="#FFE060" />
              <stop offset="40%"  stopColor="#C89000" />
              <stop offset="100%" stopColor="#4A2200" />
            </radialGradient>
            {/* Berry gradient */}
            <radialGradient id="lgBerry" cx="38%" cy="28%" r="72%">
              <stop offset="0%"   stopColor="#FFE860" />
              <stop offset="55%"  stopColor="#B8720A" />
              <stop offset="100%" stopColor="#5C2E00" />
            </radialGradient>
            {/* Ribbon */}
            <linearGradient id="lgRibbon" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#FFE566" />
              <stop offset="40%"  stopColor="#C8960A" />
              <stop offset="100%" stopColor="#6B3E00" />
            </linearGradient>
            {/* Stem path gradient */}
            <linearGradient id="lgStem" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor="#B8840A" />
              <stop offset="50%"  stopColor="#FFD060" />
              <stop offset="100%" stopColor="#B8840A" />
            </linearGradient>
          </defs>

          {/* ── Stem arcs ── */}
          <path
            d={`M 150 258 A ${WR} ${WR} 0 0 1 ${WC + WR * Math.cos((97 * Math.PI) / 180)} ${WC + WR * Math.sin((97 * Math.PI) / 180)}`}
            fill="none" stroke="url(#lgStem)" strokeWidth="2.5" opacity="0.6"
          />
          <path
            d={`M 150 258 A ${WR} ${WR} 0 0 0 ${WC + WR * Math.cos((83 * Math.PI) / 180)} ${WC + WR * Math.sin((83 * Math.PI) / 180)}`}
            fill="none" stroke="url(#lgStem)" strokeWidth="2.5" opacity="0.6"
          />

          {/* ── Inner branch (rendered first = behind outer) ── */}
          {LEFT_INNER.map((angle, i) => {
            const rad = (angle * Math.PI) / 180;
            const x   = WC + WI * Math.cos(rad);
            const y   = WC + WI * Math.sin(rad);
            const rot = angle + 90;
            return (
              <g key={`LI${i}`} transform={`rotate(${rot}, ${x}, ${y})`}>
                <ellipse cx={x} cy={y} rx={4.5} ry={15}
                  fill="url(#lgLeafInner)" opacity={0.72} />
                {/* Midrib vein */}
                <line
                  x1={x} y1={y - 13} x2={x} y2={y + 13}
                  stroke="#7A4D00" strokeWidth="0.6" opacity="0.4"
                  transform={`rotate(${-rot}, ${x}, ${y})`}
                />
              </g>
            );
          })}
          {RIGHT_INNER.map((angle, i) => {
            const a   = angle === 360 ? 0 : angle;
            const rad = (a * Math.PI) / 180;
            const x   = WC + WI * Math.cos(rad);
            const y   = WC + WI * Math.sin(rad);
            const rot = a - 90;
            return (
              <g key={`RI${i}`} transform={`rotate(${rot}, ${x}, ${y})`}>
                <ellipse cx={x} cy={y} rx={4.5} ry={15}
                  fill="url(#lgLeafInner)" opacity={0.72} />
                <line
                  x1={x} y1={y - 13} x2={x} y2={y + 13}
                  stroke="#7A4D00" strokeWidth="0.6" opacity="0.4"
                  transform={`rotate(${-rot}, ${x}, ${y})`}
                />
              </g>
            );
          })}

          {/* ── Outer branch ── */}
          {LEFT_ANGLES.map((angle, i) => {
            const rad = (angle * Math.PI) / 180;
            const x   = WC + WR * Math.cos(rad);
            const y   = WC + WR * Math.sin(rad);
            const rot = angle + 90;
            return (
              <g key={`L${i}`} transform={`rotate(${rot}, ${x}, ${y})`}>
                {/* Leaf body */}
                <ellipse cx={x} cy={y} rx={6} ry={22}
                  fill="url(#lgLeaf)" opacity={0.95} />
                {/* Central midrib */}
                <line
                  x1={x} y1={y - 20} x2={x} y2={y + 20}
                  stroke="#8B5E00" strokeWidth="0.8" opacity="0.55"
                  transform={`rotate(${-rot}, ${x}, ${y})`}
                />
                {/* Lateral vein pair */}
                <line
                  x1={x - 4} y1={y - 6} x2={x + 4} y2={y - 1}
                  stroke="#A07020" strokeWidth="0.5" opacity="0.4"
                  transform={`rotate(${-rot}, ${x}, ${y})`}
                />
                <line
                  x1={x - 4} y1={y + 4} x2={x + 4} y2={y + 9}
                  stroke="#A07020" strokeWidth="0.5" opacity="0.4"
                  transform={`rotate(${-rot}, ${x}, ${y})`}
                />
                {/* Edge highlight */}
                <ellipse cx={x - 1.5} cy={y - 7} rx={1.5} ry={6}
                  fill="rgba(255,240,100,0.25)" opacity={0.8}
                  transform={`rotate(${-rot}, ${x}, ${y})`}
                />
              </g>
            );
          })}
          {RIGHT_ANGLES.map((angle, i) => {
            const a   = angle === 360 ? 0 : angle;
            const rad = (a * Math.PI) / 180;
            const x   = WC + WR * Math.cos(rad);
            const y   = WC + WR * Math.sin(rad);
            const rot = a - 90;
            return (
              <g key={`R${i}`} transform={`rotate(${rot}, ${x}, ${y})`}>
                <ellipse cx={x} cy={y} rx={6} ry={22}
                  fill="url(#lgLeaf)" opacity={0.95} />
                <line
                  x1={x} y1={y - 20} x2={x} y2={y + 20}
                  stroke="#8B5E00" strokeWidth="0.8" opacity="0.55"
                  transform={`rotate(${-rot}, ${x}, ${y})`}
                />
                <line
                  x1={x - 4} y1={y - 6} x2={x + 4} y2={y - 1}
                  stroke="#A07020" strokeWidth="0.5" opacity="0.4"
                  transform={`rotate(${-rot}, ${x}, ${y})`}
                />
                <line
                  x1={x - 4} y1={y + 4} x2={x + 4} y2={y + 9}
                  stroke="#A07020" strokeWidth="0.5" opacity="0.4"
                  transform={`rotate(${-rot}, ${x}, ${y})`}
                />
                <ellipse cx={x - 1.5} cy={y - 7} rx={1.5} ry={6}
                  fill="rgba(255,240,100,0.25)" opacity={0.8}
                  transform={`rotate(${-rot}, ${x}, ${y})`}
                />
              </g>
            );
          })}

          {/* ── Berry clusters ── scattered between leaves on outer ring */}
          {BERRY_ANGLES.map((angle, i) => {
            const rad = (angle * Math.PI) / 180;
            const br  = WR + 6;
            const cx  = WC + br * Math.cos(rad);
            const cy  = WC + br * Math.sin(rad);
            return (
              <g key={`B${i}`}>
                <circle cx={cx} cy={cy} r={4.5} fill="url(#lgBerry)" opacity={0.9} />
                {/* Tiny specular on berry */}
                <circle cx={cx - 1.2} cy={cy - 1.4} r={1.2}
                  fill="rgba(255,255,200,0.55)" />
                {/* Two satellite berries */}
                <circle cx={cx + 5}   cy={cy - 3}   r={3}   fill="url(#lgBerry)" opacity={0.75} />
                <circle cx={cx - 4.5} cy={cy + 4}   r={2.8} fill="url(#lgBerry)" opacity={0.7} />
              </g>
            );
          })}

          {/* ── Ribbon bow at bottom ── */}
          <g transform="translate(150, 258)">
            {/* Left wing */}
            <path d="M 0 0 C -8 -10 -28 -10 -26 2 C -24 12 -8 10 0 0 Z"
              fill="url(#lgRibbon)" opacity="0.95" />
            {/* Right wing */}
            <path d="M 0 0 C 8 -10 28 -10 26 2 C 24 12 8 10 0 0 Z"
              fill="url(#lgRibbon)" opacity="0.95" />
            {/* Left tail */}
            <path d="M 0 0 C -6 6 -14 16 -12 22 C -10 26 -4 22 0 0 Z"
              fill="url(#lgRibbon)" opacity="0.85" />
            {/* Right tail */}
            <path d="M 0 0 C 6 6 14 16 12 22 C 10 26 4 22 0 0 Z"
              fill="url(#lgRibbon)" opacity="0.85" />
            {/* Center knot */}
            <ellipse cx="0" cy="1" rx="7" ry="7" fill="url(#lgRibbon)" opacity="1" />
            <ellipse cx="-1.5" cy="-1.5" rx="2.5" ry="2"
              fill="rgba(255,245,120,0.6)" />
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
