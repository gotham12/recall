import { useEffect, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useAppStore } from '../store/appStore';
import { duration } from '../lib/motion';

const LETTERS = ['R', 'E', 'C', 'A', 'L', 'L'];

export default function LoadingScreen() {
  const setScreen  = useAppStore(s => s.setScreen);
  const screenRef  = useRef<HTMLDivElement>(null);
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useGSAP(() => {
    const tl = gsap.timeline();

    tl.from('.sl-morph--1', { scale: 0, opacity: 0, duration: duration(1.6), ease: 'power3.out' }, 0);
    tl.from('.sl-morph--2', { scale: 0, opacity: 0, duration: duration(1.6), ease: 'power3.out' }, 0.15);
    tl.from('.sl-morph--3', { scale: 0, opacity: 0, duration: duration(1.4), ease: 'power3.out' }, 0.30);

    tl.from('.sl-glass-stage', {
      scale: 0.6, opacity: 0,
      duration: duration(1.0), ease: 'back.out(1.4)',
    }, 0.05);

    tl.from('.sl-logo', {
      scale: 0.6, opacity: 0,
      duration: duration(0.9), ease: 'back.out(1.4)',
    }, 0.20);

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
      gsap.to('.sl-glass-stage', { scale: 0, opacity: 0, duration: duration(0.4), ease: 'back.in(1.5)', delay: 0.05 });
      gsap.to('.sl-logo', { scale: 0.7, opacity: 0, duration: duration(0.35), ease: 'back.in(1.5)', delay: 0.05 });
      gsap.to('.sl-subtitle, .sl-tags', { opacity: 0, duration: duration(0.3) });
      if (screenRef.current) gsap.to(screenRef.current, { opacity: 0, duration: duration(0.5), delay: 0.15 });
    }, DISPLAY_MS);

    const loginTimer = setTimeout(() => setScreen('login'), DISPLAY_MS + EXIT_MS);

    return () => { clearTimeout(exitTimer); clearTimeout(loginTimer); };
  }, [setScreen]);

  return (
    <div ref={screenRef} className="sl-screen" aria-label="Loading Recall">

      {/* Liquid glass morphing orbs */}
      <div className="sl-glass-stage" aria-hidden>
        <div className="sl-morph sl-morph--1" />
        <div className="sl-morph sl-morph--2" />
        <div className="sl-morph sl-morph--3" />
        {/* Specular reflections */}
        <div className="sl-glass-shine sl-glass-shine--1" />
        <div className="sl-glass-shine sl-glass-shine--2" />
      </div>

      {/* Logo */}
      <img
        src="/logo.png"
        alt="Recall"
        className="sl-logo"
        aria-hidden
      />

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
