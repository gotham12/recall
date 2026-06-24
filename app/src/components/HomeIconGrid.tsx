import { useState, useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import { useAppStore } from '../store/appStore';

interface IconDef {
  id: string;
  label: string;
  bg: string;
  bgDark: string;
  glow: string;
  icon: () => JSX.Element;
}

// ─── SVG icons ────────────────────────────────────────────────────────────────

function IcoClara() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: 44, height: 44 }}>
      <circle cx="32" cy="24" r="11" fill="rgba(255,255,255,0.97)" />
      <path d="M10 58c0-12.15 9.85-22 22-22s22 9.85 22 22" fill="rgba(255,255,255,0.90)" />
      <path d="M49 29c3-4 3-10.5 0-14.5" stroke="rgba(255,255,255,0.78)" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M55 32c5-7.5 5-18.5 0-26" stroke="rgba(255,255,255,0.48)" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function IcoMeds() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: 44, height: 44 }}>
      <rect x="13" y="22" width="38" height="20" rx="10" fill="rgba(255,255,255,0.94)" />
      <clipPath id="pR"><rect x="32" y="22" width="19" height="20" rx="10" /></clipPath>
      <rect x="32" y="22" width="19" height="20" rx="10" fill="rgba(255,255,255,0.40)" clipPath="url(#pR)" />
      <line x1="20.5" y1="32" x2="27.5" y2="32" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="24" y1="28.5" x2="24" y2="35.5" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function IcoGames() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: 44, height: 44 }}>
      <rect x="11" y="11" width="17" height="17" rx="4.5" fill="rgba(255,255,255,0.97)" />
      <rect x="32" y="11" width="17" height="17" rx="4.5" fill="rgba(255,255,255,0.65)" />
      <rect x="11" y="36" width="17" height="17" rx="4.5" fill="rgba(255,255,255,0.65)" />
      <rect x="32" y="36" width="17" height="17" rx="4.5" fill="rgba(255,255,255,0.97)" />
    </svg>
  );
}

function IcoRoutine() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: 44, height: 44 }}>
      <path d="M11 18l4.5 4.5L23 15" stroke="rgba(255,255,255,0.97)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="29" y1="20" x2="52" y2="20" stroke="rgba(255,255,255,0.90)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M11 32l4.5 4.5L23 29" stroke="rgba(255,255,255,0.97)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="29" y1="34" x2="52" y2="34" stroke="rgba(255,255,255,0.90)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M11 46l4.5 4.5L23 43" stroke="rgba(255,255,255,0.70)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="29" y1="48" x2="44" y2="48" stroke="rgba(255,255,255,0.65)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function IcoToday() {
  const day = new Date().getDate();
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: 44, height: 44 }}>
      <rect x="8" y="12" width="48" height="42" rx="8" fill="white" />
      <rect x="8" y="12" width="48" height="14" rx="8" fill="#FF3B30" />
      <rect x="8" y="20" width="48" height="6" fill="#FF3B30" />
      <line x1="22" y1="8" x2="22" y2="16" stroke="rgba(0,0,0,0.35)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="42" y1="8" x2="42" y2="16" stroke="rgba(0,0,0,0.35)" strokeWidth="2.5" strokeLinecap="round" />
      <text x="32" y="50" textAnchor="middle" fontSize="18" fontWeight="700"
        fontFamily="-apple-system,BlinkMacSystemFont,sans-serif" fill="rgba(0,0,0,0.82)"
      >{day}</text>
    </svg>
  );
}

function IcoMemory() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: 44, height: 44 }}>
      <path d="M32 52C32 52 10 40 10 24a11.5 11.5 0 0 1 22-4.7A11.5 11.5 0 0 1 54 24C54 40 32 52 32 52Z"
        fill="rgba(255,255,255,0.95)" />
      <circle cx="22" cy="21" r="4" fill="rgba(255,255,255,0.40)" />
    </svg>
  );
}

function IcoSafety() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: 44, height: 44 }}>
      <path d="M32 8 C32 8 12 16 12 30 C12 42 32 56 32 56 C32 56 52 42 52 30 C52 16 32 8 32 8Z"
        fill="rgba(255,255,255,0.95)" />
      <line x1="32" y1="24" x2="32" y2="36" stroke="#EF4444" strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="43" r="2.5" fill="#EF4444" />
    </svg>
  );
}

function IcoFaces() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: 44, height: 44 }}>
      <circle cx="21" cy="24" r="9" fill="rgba(255,255,255,0.78)" />
      <circle cx="40" cy="22" r="10" fill="rgba(255,255,255,0.97)" />
      <path d="M7 54c0-9.4 6.3-15 14-15" stroke="rgba(255,255,255,0.65)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M26 39c7.7 0 14 5.6 14 15" stroke="rgba(255,255,255,0.92)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── Supervisor icons ─────────────────────────────────────────────────────────

function IcoOverview() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: 44, height: 44 }}>
      <rect x="10" y="34" width="11" height="20" rx="3.5" fill="rgba(255,255,255,0.90)" />
      <rect x="26" y="22" width="11" height="32" rx="3.5" fill="rgba(255,255,255,0.97)" />
      <rect x="42" y="10" width="11" height="44" rx="3.5" fill="rgba(255,255,255,0.97)" />
    </svg>
  );
}

function IcoAlerts() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: 44, height: 44 }}>
      <path d="M32 10 C20 10 14 20 14 30 L14 42 H50 L50 30 C50 20 44 10 32 10Z" fill="rgba(255,255,255,0.95)" />
      <rect x="24" y="42" width="16" height="4" fill="rgba(255,255,255,0.80)" />
      <rect x="28" y="46" width="8" height="2" rx="1" fill="rgba(255,255,255,0.70)" />
      <circle cx="48" cy="14" r="8" fill="#FF3B30" />
      <text x="48" y="18" textAnchor="middle" fontSize="10" fontWeight="700"
        fontFamily="-apple-system,sans-serif" fill="white">!</text>
    </svg>
  );
}

function IcoStats() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: 44, height: 44 }}>
      <polyline points="10,46 22,30 34,38 46,18 56,24"
        stroke="rgba(255,255,255,0.95)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="46" r="3" fill="rgba(255,255,255,0.95)" />
      <circle cx="22" cy="30" r="3" fill="rgba(255,255,255,0.95)" />
      <circle cx="34" cy="38" r="3" fill="rgba(255,255,255,0.95)" />
      <circle cx="46" cy="18" r="3" fill="rgba(255,255,255,0.95)" />
      <circle cx="56" cy="24" r="3" fill="rgba(255,255,255,0.95)" />
    </svg>
  );
}

function IcoJournal() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: 44, height: 44 }}>
      <rect x="12" y="10" width="36" height="44" rx="6" fill="rgba(255,255,255,0.94)" />
      <line x1="20" y1="22" x2="44" y2="22" stroke="#06B6D4" strokeWidth="2" strokeLinecap="round" />
      <line x1="20" y1="30" x2="44" y2="30" stroke="#06B6D4" strokeWidth="2" strokeLinecap="round" />
      <line x1="20" y1="38" x2="34" y2="38" stroke="#06B6D4" strokeWidth="2" strokeLinecap="round" />
      <circle cx="44" cy="44" r="10" fill="#06B6D4" />
      <line x1="44" y1="40" x2="44" y2="48" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="40" y1="44" x2="48" y2="44" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function IcoRoutineMgr() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: 44, height: 44 }}>
      <circle cx="32" cy="32" r="18" stroke="rgba(255,255,255,0.90)" strokeWidth="2.5" />
      <line x1="32" y1="18" x2="32" y2="32" stroke="rgba(255,255,255,0.97)" strokeWidth="3" strokeLinecap="round" />
      <line x1="32" y1="32" x2="42" y2="38" stroke="rgba(255,255,255,0.80)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="32" cy="32" r="2.5" fill="rgba(255,255,255,0.97)" />
    </svg>
  );
}

function IcoSwitch() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: 44, height: 44 }}>
      <circle cx="26" cy="22" r="9" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" />
      <path d="M8 50c0-9.9 8.1-18 18-18" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M42 34l6 6-6 6" stroke="rgba(255,255,255,0.97)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="26" y1="40" x2="48" y2="40" stroke="rgba(255,255,255,0.97)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── Icon definitions ─────────────────────────────────────────────────────────

export const PATIENT_ICONS: IconDef[] = [
  { id: 'voice',    label: 'Clara',   bg: '#2563EB', bgDark: '#1D4ED8', glow: 'rgba(37,99,235,0.50)',   icon: IcoClara },
  { id: 'meds',     label: 'Meds',    bg: '#EA6C00', bgDark: '#C45C00', glow: 'rgba(234,108,0,0.50)',   icon: IcoMeds },
  { id: 'games',    label: 'Games',   bg: '#7C3AED', bgDark: '#6D28D9', glow: 'rgba(124,58,237,0.50)',  icon: IcoGames },
  { id: 'routine',  label: 'Routine', bg: '#16A34A', bgDark: '#15803D', glow: 'rgba(22,163,74,0.50)',   icon: IcoRoutine },
  { id: 'events',   label: 'Today',   bg: '#FFFFFF', bgDark: '#F5F5F5', glow: 'rgba(0,0,0,0.16)',       icon: IcoToday },
  { id: 'memory',   label: 'Memory',  bg: '#DB2777', bgDark: '#BE185D', glow: 'rgba(219,39,119,0.50)',  icon: IcoMemory },
  { id: 'safety',   label: 'Safety',  bg: '#DC2626', bgDark: '#B91C1C', glow: 'rgba(220,38,38,0.50)',   icon: IcoSafety },
  { id: 'faces',    label: 'Faces',   bg: '#0891B2', bgDark: '#0E7490', glow: 'rgba(8,145,178,0.50)',   icon: IcoFaces },
  { id: '__switch', label: 'Switch',  bg: '#374151', bgDark: '#1F2937', glow: 'rgba(55,65,81,0.40)',    icon: IcoSwitch },
];

export const SUPERVISOR_ICONS: IconDef[] = [
  { id: 'home',        label: 'Overview', bg: '#1D4ED8', bgDark: '#1E40AF', glow: 'rgba(29,78,216,0.50)',  icon: IcoOverview },
  { id: 'events',      label: 'Events',   bg: '#DC2626', bgDark: '#B91C1C', glow: 'rgba(220,38,38,0.50)', icon: IcoAlerts },
  { id: 'medications', label: 'Meds',     bg: '#EA6C00', bgDark: '#C45C00', glow: 'rgba(234,108,0,0.50)', icon: IcoMeds },
  { id: 'routine',     label: 'Routine',  bg: '#16A34A', bgDark: '#15803D', glow: 'rgba(22,163,74,0.50)', icon: IcoRoutineMgr },
  { id: 'stats',       label: 'Stats',    bg: '#7C3AED', bgDark: '#6D28D9', glow: 'rgba(124,58,237,0.50)', icon: IcoStats },
  { id: 'journal',     label: 'Journal',  bg: '#0E7490', bgDark: '#155E75', glow: 'rgba(14,116,144,0.50)', icon: IcoJournal },
  { id: '__switch',    label: 'Patient',  bg: '#374151', bgDark: '#1F2937', glow: 'rgba(55,65,81,0.40)',   icon: IcoSwitch },
];

// ─── Room background SVG ──────────────────────────────────────────────────────

function RoomBackground() {
  return (
    <svg
      viewBox="0 0 390 780"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      aria-hidden
    >
      {/* Base room tone */}
      <rect width="390" height="780" fill="#EBEBEA" />

      {/* Left wall plane */}
      <polygon points="0,0 204,0 196,580 0,780" fill="#F1F0EE" />

      {/* Right wall plane */}
      <polygon points="204,0 390,0 390,780 196,580" fill="#E5E5E3" />

      {/* Corner shadow */}
      <linearGradient id="cnrL" x1="0%" x2="100%">
        <stop offset="0%" stopColor="rgba(0,0,0,0)" />
        <stop offset="100%" stopColor="rgba(0,0,0,0.055)" />
      </linearGradient>
      <polygon points="180,0 204,0 196,580 176,580" fill="url(#cnrL)" />
      <linearGradient id="cnrR" x1="0%" x2="100%">
        <stop offset="0%" stopColor="rgba(0,0,0,0.055)" />
        <stop offset="100%" stopColor="rgba(0,0,0,0)" />
      </linearGradient>
      <polygon points="204,0 228,0 218,580 196,580" fill="url(#cnrR)" />

      {/* Window light strips on right wall */}
      <polygon points="210,0  390,0  390,55  210,70"  fill="rgba(255,255,255,0.13)" />
      <polygon points="210,80 390,30 390,110 210,160" fill="rgba(255,255,255,0.09)" />
      <polygon points="210,180 390,130 390,220 210,270" fill="rgba(255,255,255,0.07)" />
      <polygon points="210,290 390,240 390,330 210,380" fill="rgba(255,255,255,0.06)" />

      {/* Diagonal shadow from window (adds depth) */}
      <polygon points="210,0 240,0 220,120 210,120" fill="rgba(0,0,0,0.018)" />

      {/* Floor */}
      <linearGradient id="flr" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#D6D5D2" />
        <stop offset="100%" stopColor="#CCCBC8" />
      </linearGradient>
      <polygon points="0,780 390,780 390,600 196,580 0,580" fill="url(#flr)" />

      {/* Floor-wall crease shadow */}
      <polygon points="0,580 196,580 204,590 0,590" fill="rgba(0,0,0,0.07)" />
      <polygon points="196,580 390,600 390,608 196,588" fill="rgba(0,0,0,0.06)" />

      {/* ── Chair (bottom-left) ── */}
      <rect x="8"  y="498" width="88" height="70" rx="6"  fill="#F4F3F1" />
      <rect x="14" y="504" width="76" height="58" rx="4"  fill="#F8F7F5" />
      <rect x="4"  y="560" width="96" height="26" rx="5"  fill="#F4F3F1" />
      <rect x="4"  y="520" width="10" height="46" rx="5"  fill="#EEEEED" />
      <rect x="90" y="520" width="10" height="46" rx="5"  fill="#EEEEED" />
      <rect x="12" y="586" width="8"  height="36" rx="4"  fill="#E6E5E3" />
      <rect x="84" y="586" width="8"  height="36" rx="4"  fill="#E6E5E3" />
      <ellipse cx="52" cy="622" rx="44" ry="6" fill="rgba(0,0,0,0.07)" />

      {/* ── Sofa / bench (center-bottom) ── */}
      <rect x="110" y="528" width="220" height="52" rx="8" fill="#EFEEEC" />
      <line x1="220" y1="528" x2="220" y2="580" stroke="rgba(0,0,0,0.04)" strokeWidth="1" />
      <rect x="106" y="575" width="228" height="32" rx="6" fill="#F0EFED" />
      <rect x="106" y="540" width="14"  height="67" rx="7" fill="#E8E7E5" />
      <rect x="320" y="540" width="14"  height="67" rx="7" fill="#E8E7E5" />
      <rect x="120" y="607" width="8"   height="22" rx="4" fill="#E0DFDD" />
      <rect x="212" y="607" width="8"   height="22" rx="4" fill="#E0DFDD" />
      <rect x="310" y="607" width="8"   height="22" rx="4" fill="#E0DFDD" />
      <ellipse cx="220" cy="629" rx="110" ry="7" fill="rgba(0,0,0,0.07)" />

      {/* Baseboards */}
      <rect x="0"   y="572" width="196" height="8" fill="#E4E3E1" />
      <polygon points="196,572 390,592 390,600 196,580" fill="#DCDBD9" />
    </svg>
  );
}

// ─── Icon puck ────────────────────────────────────────────────────────────────

function lighten(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 0xff) + (255 - ((n >> 16) & 0xff)) * amount));
  const g = Math.min(255, Math.round(((n >> 8)  & 0xff) + (255 - ((n >> 8)  & 0xff)) * amount));
  const b = Math.min(255, Math.round((n & 0xff)         + (255 - (n & 0xff))          * amount));
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

function IconPuck({ def, onTap, index }: { def: IconDef; onTap: () => void; index: number }) {
  const [active, setActive] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const isLight = def.bg === '#FFFFFF' || def.bg === '#F5F5F5';
  const gradBg = isLight
    ? `radial-gradient(circle at 38% 28%, #fff 0%, #F5F5F3 70%, #EEEEED 100%)`
    : `radial-gradient(circle at 38% 28%, ${lighten(def.bg, 0.30)} 0%, ${def.bg} 55%, ${def.bgDark} 100%)`;

  // GSAP spring press
  const handleDown = () => {
    setActive(true);
    if (btnRef.current) {
      gsap.to(btnRef.current, { scale: 0.88, duration: 0.12, ease: 'power2.out', overwrite: true });
    }
  };
  const handleUp = () => {
    setActive(false);
    if (btnRef.current) {
      gsap.to(btnRef.current, { scale: 1, duration: 0.5, ease: 'elastic.out(1.2, 0.5)', overwrite: true });
    }
    onTap();
  };
  const handleCancel = () => {
    setActive(false);
    if (btnRef.current) {
      gsap.to(btnRef.current, { scale: 1, duration: 0.35, ease: 'back.out(2)', overwrite: true });
    }
  };

  return (
    <div className="vis-puck-wrap" data-puck-index={index}>
      <div className="vis-puck-shadow" style={{ '--glow': def.glow } as React.CSSProperties} />
      <button
        ref={btnRef}
        type="button"
        aria-label={def.label}
        className={`vis-puck${active ? ' vis-puck--active' : ''}`}
        style={{
          background: gradBg,
          boxShadow: `
            inset 0 2px 0 rgba(255,255,255,${isLight ? '0.90' : '0.30'}),
            inset 0 -2px 0 rgba(0,0,0,${isLight ? '0.08' : '0.20'}),
            0 16px 40px ${def.glow},
            0 4px 16px rgba(0,0,0,0.20),
            0 1px 2px rgba(0,0,0,0.10)
          `,
          border: isLight ? '0.5px solid rgba(0,0,0,0.10)' : 'none',
          willChange: 'transform',
        }}
        onPointerDown={handleDown}
        onPointerUp={handleUp}
        onPointerLeave={handleCancel}
        onPointerCancel={handleCancel}
      >
        <def.icon />
      </button>
      <span className="vis-puck-label" style={{ color: isLight ? 'rgba(0,0,0,0.60)' : 'rgba(0,0,0,0.52)' }}>
        {def.label}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface HomeIconGridProps {
  role: 'patient' | 'supervisor';
  userName?: string;
  onSelect: (id: string) => void;
  onSwitchRole: () => void;
}

export default function HomeIconGrid({ role, userName, onSelect, onSwitchRole }: HomeIconGridProps) {
  const icons = role === 'patient' ? PATIENT_ICONS : SUPERVISOR_ICONS;
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTap = (id: string) => {
    if (id === '__switch') { onSwitchRole(); return; }
    onSelect(id);
  };

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const dateStr = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  // ─── GSAP entrance animations ───────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.from('.vis-home-bg', { opacity: 0, duration: 0.55 }, 0);
      tl.from('.vis-clock',   { y: -28, opacity: 0, duration: 0.65 }, 0.08);
      tl.from('.vis-role-badge', { x: 20, opacity: 0, duration: 0.45 }, 0.20);
      tl.from('.vis-puck-wrap', {
        y: 60, opacity: 0, scale: 0.68,
        duration: 0.60,
        stagger: { amount: 0.40, from: 'start' },
        ease: 'back.out(1.8)',
      }, 0.28);
      tl.from('.vis-puck-shadow', {
        opacity: 0, scaleX: 0.2, duration: 0.40,
        stagger: { amount: 0.30, from: 'start' },
      }, 0.50);
      tl.from('.vis-name-bar', { opacity: 0, y: 12, duration: 0.40 }, 0.55);
    }, containerRef);

    return () => ctx.revert();
  }, [role]);

  return (
    <div ref={containerRef} className="vis-home" role="main" aria-label="Home">

      {/* Background — purely decorative, sits at z-index 0 */}
      <div className="vis-home-bg" aria-hidden>
        <RoomBackground />
      </div>

      {/* Top bar: clock left, role badge right — z-index 1, no overlap */}
      <div className="vis-topbar">
        <div className="vis-clock">
          <div className="vis-time">{timeStr}</div>
          <div className="vis-date">{dateStr}</div>
        </div>
        <div className="vis-role-badge">
          {role === 'patient' ? 'Patient' : 'Supervisor'}
        </div>
      </div>

      {/* Icon grid — flex: 1, centered both axes */}
      <div className="vis-grid-area">
        <div className="vis-icon-grid">
          {icons.map((icon, i) => (
            <IconPuck key={icon.id} def={icon} index={i} onTap={() => handleTap(icon.id)} />
          ))}
        </div>
      </div>

      {/* Name bar at bottom */}
      {userName && (
        <div className="vis-name-bar">{userName}</div>
      )}
    </div>
  );
}
