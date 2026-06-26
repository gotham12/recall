import { useState, useRef, useEffect, useCallback } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, ResponsiveContainer, Tooltip,
} from 'recharts';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAppStore } from '../store/appStore';
import { useACSE } from '../hooks/useACSE';
import { db, type Event, type Medication, type User } from '../db/db';
import { isMedicationDueSoon } from '../lib/schedule';
import VoiceAgent from '../components/VoiceAgent';
import MedTracker from '../components/MedTracker';
import ACSEDashboard from '../components/ACSEDashboard';
import StateReconCard from '../components/StateReconCard';
import WhereAmICard from '../components/WhereAmICard';
import FamiliarFaces from '../components/FamiliarFaces';
import SafetyCircle from '../components/SafetyCircle';
import SettingsSheet from '../components/SettingsSheet';
import MemoryPhotoRecap from '../components/MemoryPhotoRecap';
import RoutineChecklist from '../components/RoutineChecklist';
import GameHub from '../components/games/GameHub';
import GoldenPathDemo from '../components/GoldenPathDemo';

gsap.registerPlugin(ScrollTrigger);

type PatientTab = 'today' | 'care' | 'clara' | 'routine';

const PANEL_TITLES: Record<string, string> = {
  voice: 'Clara',
  meds: 'Medications',
  games: 'Mind Games',
  memory: 'Memory',
  safety: 'Safety Circle',
  faces: 'Familiar Faces',
  articles: 'Health Articles',
  watch: 'Activity Details',
};

// ── Real article data with verified external URLs ─────────────────────────
interface Article {
  icon: JSX.Element;
  color: string;
  bg: string;
  title: string;
  source: string;
  time: string;
  tag: string;
  url: string;
  summary: string;
}

const ARTICLES: Article[] = [
  {
    icon: <IcoBrain color="#7C3AED" size={20} />,
    color: '#7C3AED', bg: '#F3EEFF',
    title: 'How Exercise Protects Memory & Thinking Skills',
    source: 'Harvard Health', time: '4 min read', tag: 'Brain Health',
    url: 'https://www.health.harvard.edu/mind-and-mood/regular-exercise-changes-the-brain-to-improve-memory-thinking-skills',
    summary: 'Aerobic exercise grows the hippocampus — the brain\'s memory center — improving recall and reducing dementia risk.',
  },
  {
    icon: <IcoPill color="#EA6C00" size={20} />,
    color: '#EA6C00', bg: '#FFF3E5',
    title: 'Taking Medications Safely as We Age',
    source: 'NIH on Aging', time: '6 min read', tag: 'Medications',
    url: 'https://www.nia.nih.gov/health/safe-use-medicines-older-adults',
    summary: 'Older adults are more sensitive to medications. Learn how to manage timing, interactions, and side effects.',
  },
  {
    icon: <IcoMoon color="#1C1C6E" size={20} />,
    color: '#1C1C6E', bg: '#EEF0FF',
    title: 'Sleep & Dementia Risk: What the Research Shows',
    source: 'NIH on Aging', time: '5 min read', tag: 'Sleep',
    url: 'https://www.nia.nih.gov/health/sleep/sleep-and-dementia',
    summary: 'Poor sleep is linked to greater amyloid buildup. Getting 7–8 hours consistently may lower dementia risk.',
  },
  {
    icon: <IcoLeaf color="#16A34A" size={20} />,
    color: '#16A34A', bg: '#E8F5E9',
    title: 'The MIND Diet: Foods That Keep Your Brain Sharp',
    source: 'Cleveland Clinic', time: '7 min read', tag: 'Nutrition',
    url: 'https://health.clevelandclinic.org/what-is-mind-diet',
    summary: 'Berries, leafy greens, olive oil, and fish are among the top brain-protective foods in the MIND diet.',
  },
  {
    icon: <IcoRun color="#0891B2" size={20} />,
    color: '#0891B2', bg: '#E5F6FB',
    title: 'Exercise & Physical Activity for Older Adults',
    source: 'NIH on Aging', time: '5 min read', tag: 'Exercise',
    url: 'https://www.nia.nih.gov/health/exercise-physical-activity',
    summary: 'Even light activity — walking, stretching, balance exercises — reduces fall risk and boosts cognition.',
  },
  {
    icon: <IcoUsers color="#DB2777" size={20} />,
    color: '#DB2777', bg: '#FDE8F3',
    title: 'Social Connection as Medicine for the Brain',
    source: 'Alzheimer\'s Assoc.', time: '4 min read', tag: 'Wellness',
    url: 'https://www.alz.org/help-support/brain_health/10_ways_to_love_your_brain',
    summary: 'People who stay socially engaged have lower rates of cognitive decline. Connection is protective.',
  },
  {
    icon: <IcoHeart color="#FF375F" size={20} />,
    color: '#FF375F', bg: '#FFF0F3',
    title: 'Heart Health and Brain Health Are Linked',
    source: 'Mayo Clinic', time: '5 min read', tag: 'Cardio',
    url: 'https://www.mayoclinic.org/diseases-conditions/alzheimers-disease/in-depth/alzheimers-prevention/art-20048560',
    summary: 'Controlling blood pressure, cholesterol, and diabetes dramatically lowers Alzheimer\'s risk.',
  },
  {
    icon: <IcoWind color="#0891B2" size={20} />,
    color: '#0891B2', bg: '#E5F6FB',
    title: 'Breathing Exercises for Stress & Cognition',
    source: 'Harvard Health', time: '4 min read', tag: 'Mindfulness',
    url: 'https://www.health.harvard.edu/mind-and-mood/relaxation-techniques-breath-control-helps-quell-errant-stress-response',
    summary: 'Slow deep breathing activates the parasympathetic system, reducing cortisol and improving focus.',
  },
];

const TIPS = [
  {
    icon: <IcoWalk color="#007AFF" size={18} />,
    bg: '#E8F2FF',
    title: 'Walk 10 minutes after each meal',
    sub: 'Lowers blood sugar and aids digestion',
    url: 'https://www.health.harvard.edu/staying-healthy/walking-your-steps-to-health',
  },
  {
    icon: <IcoDrop color="#34C759" size={18} />,
    bg: '#E8F8ED',
    title: 'Drink 8 glasses of water today',
    sub: 'Hydration supports cognitive function',
    url: 'https://www.mayoclinic.org/healthy-lifestyle/nutrition-and-healthy-eating/in-depth/water/art-20044256',
  },
  {
    icon: <IcoWind color="#5AC8FA" size={18} />,
    bg: '#E5F6FB',
    title: 'Try 5 minutes of deep breathing',
    sub: 'Reduces cortisol and improves focus',
    url: 'https://www.health.harvard.edu/mind-and-mood/relaxation-techniques-breath-control-helps-quell-errant-stress-response',
  },
  {
    icon: <IcoMusic color="#1DB954" size={18} />,
    bg: '#E8F8ED',
    title: 'Listen to familiar music',
    sub: 'Opens Spotify — search familiar songs',
    url: 'https://open.spotify.com/search/familiar%20songs%20classic%20hits',
  },
];

// ── SVG icon components ───────────────────────────────────────────────────
function IcoBrain({ color = 'currentColor', size = 20 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
      <path d="M12 5C9.5 5 7.5 6.5 7.5 9c0 1.2.5 2.3 1.3 3.1C7.7 12.7 7 13.8 7 15c0 2.2 1.8 4 4 4 .4 0 .7 0 1-.1V5z" stroke={color} strokeWidth="1.7" strokeLinecap="round"/>
      <path d="M12 5c2.5 0 4.5 1.5 4.5 4 0 1.2-.5 2.3-1.3 3.1.6.6 1.3 1.7 1.3 2.9 0 2.2-1.8 4-4 4-.4 0-.7 0-1-.1V5z" stroke={color} strokeWidth="1.7" strokeLinecap="round"/>
      <path d="M7.5 9H5M9 6.5 7.5 5M7 13l-2 .5M16.5 9H19M15 6.5l1.5-1.5M17 13l2 .5" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
function IcoPill({ color = 'currentColor', size = 20 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
      <rect x="3.5" y="10" width="17" height="8" rx="4" stroke={color} strokeWidth="1.8"/>
      <line x1="12" y1="10" x2="12" y2="18" stroke={color} strokeWidth="1.8"/>
      <line x1="7.5" y1="14" x2="10" y2="14" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}
function IcoCalendar({ color = 'currentColor', size = 20 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
      <rect x="3" y="4" width="18" height="17" rx="3.5" stroke={color} strokeWidth="1.7"/>
      <line x1="3" y1="9" x2="21" y2="9" stroke={color} strokeWidth="1.7"/>
      <line x1="8" y1="2.5" x2="8" y2="5.5" stroke={color} strokeWidth="1.7" strokeLinecap="round"/>
      <line x1="16" y1="2.5" x2="16" y2="5.5" stroke={color} strokeWidth="1.7" strokeLinecap="round"/>
      <circle cx="12" cy="15" r="1.2" fill={color}/>
    </svg>
  );
}
function IcoUsers({ color = 'currentColor', size = 20 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
      <circle cx="9" cy="8" r="4" stroke={color} strokeWidth="1.7"/>
      <circle cx="16" cy="7" r="3.5" stroke={color} strokeWidth="1.7"/>
      <path d="M2 20c0-3.9 3.1-7 7-7" stroke={color} strokeWidth="1.7" strokeLinecap="round"/>
      <path d="M12 14c3.3 0 6 2.7 6 7" stroke={color} strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  );
}
function IcoShield({ color = 'currentColor', size = 20 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
      <path d="M12 3L4 7v5c0 5 3.6 9.7 8 11 4.4-1.3 8-6 8-11V7L12 3z" stroke={color} strokeWidth="1.8" strokeLinejoin="round"/>
      <line x1="12" y1="10" x2="12" y2="15" stroke={color} strokeWidth="2" strokeLinecap="round"/>
      <circle cx="12" cy="8.5" r="0.8" fill={color}/>
    </svg>
  );
}
function IcoGrid({ color = 'currentColor', size = 20 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
      <rect x="2" y="2" width="8" height="8" rx="2" stroke={color} strokeWidth="1.8"/>
      <rect x="14" y="2" width="8" height="8" rx="2" stroke={color} strokeWidth="1.8"/>
      <rect x="2" y="14" width="8" height="8" rx="2" stroke={color} strokeWidth="1.8"/>
      <rect x="14" y="14" width="8" height="8" rx="2" stroke={color} strokeWidth="1.8"/>
    </svg>
  );
}
function IcoMic({ color = 'currentColor', size = 20 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
      <rect x="9" y="2" width="6" height="11" rx="3" stroke={color} strokeWidth="1.8"/>
      <path d="M5 10c0 3.9 3.1 7 7 7s7-3.1 7-7" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="12" y1="17" x2="12" y2="21" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="8" y1="21" x2="16" y2="21" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}
function IcoHeart({ color = 'currentColor', size = 20 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IcoMoon({ color = 'currentColor', size = 20 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IcoLeaf({ color = 'currentColor', size = 20 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
      <path d="M17 8C17 14 12 17 6 18c0-6 3-12 11-14z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M6 18l5-5" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}
function IcoRun({ color = 'currentColor', size = 20 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
      <circle cx="13" cy="4" r="1.5" fill={color}/>
      <path d="M7 20l3-5 2 2 3-4 2 3" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9 11l2-4 3 1 3-2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IcoWalk({ color = 'currentColor', size = 18 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
      <circle cx="12" cy="4" r="2" fill={color}/>
      <path d="M9 22l1-6 2 2 1-6" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10.5 9.5L8 11l1 4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M13.5 9.5L16 11l-1 4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IcoDrop({ color = 'currentColor', size = 18 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IcoWind({ color = 'currentColor', size = 18 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
      <path d="M9.59 4.59A2 2 0 1 1 11 8H2" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M12.59 19.41A2 2 0 1 0 14 16H2" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M17.59 11.41A2 2 0 1 1 19 8H2" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}
function IcoMusic({ color = 'currentColor', size = 18 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
      <path d="M9 18V5l12-2v13" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="6" cy="18" r="3" stroke={color} strokeWidth="1.8"/>
      <circle cx="18" cy="16" r="3" stroke={color} strokeWidth="1.8"/>
    </svg>
  );
}
function IcoExternal({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <polyline points="15 3 21 3 21 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="10" y1="14" x2="21" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}
function IcoToday() {
  return <svg viewBox="0 0 24 24" fill="none" width="26" height="26"><rect x="3" y="4" width="18" height="17" rx="3.5" stroke="currentColor" strokeWidth="1.7"/><line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" strokeWidth="1.7"/><line x1="8" y1="2.5" x2="8" y2="5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><line x1="16" y1="2.5" x2="16" y2="5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><circle cx="12" cy="15" r="1.2" fill="currentColor"/></svg>;
}
function IcoCare() {
  return <svg viewBox="0 0 24 24" fill="none" width="26" height="26"><path d="M12 21s-7-5-7-10.5A5.5 5.5 0 0 1 12 5.5 5.5 5.5 0 0 1 19 10.5C19 16 12 21 12 21z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function IcoClara() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="26" height="26">
      <rect x="9" y="2" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.7"/>
      <path d="M5 10c0 3.9 3.1 7 7 7s7-3.1 7-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
      <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
      <line x1="8" y1="21" x2="16" y2="21" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  );
}
function IcoRoutine() {
  return <svg viewBox="0 0 24 24" fill="none" width="26" height="26"><path d="M5 12l4 4 10-9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function IcoWatch({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
      <rect x="6" y="2" width="12" height="20" rx="5" stroke="currentColor" strokeWidth="1.8"/>
      <rect x="9" y="0.5" width="6" height="3" rx="1.5" fill="currentColor"/>
      <path d="M12 8v4l2.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}
function IcoActivity({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IcoSteps({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
      <path d="M6 18l4-12 4 8 3-4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IcoFlame({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
      <path d="M12 2c-4 4-4 8-2 10-1-1-2-2-1-5-3 3-3 8 0 11 1 1 3 2 5 2 4 0 7-3 7-7 0-3-2-5-4-6 1 3-1 5-3 5 1-2 1-7-2-10z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ── Chart data ────────────────────────────────────────────────────────────
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const STEPS_DATA = [4200, 6800, 5100, 7400, 3900, 8100, 6200].map((v, i) => ({ day: DAYS[i], steps: v }));
const HR_DATA = Array.from({ length: 24 }, (_, i) => ({
  h: i,
  bpm: 55 + Math.round(20 * Math.sin((i - 6) * 0.4) + 8 * Math.sin(i * 1.1) + (i > 7 && i < 20 ? 12 : 0)),
}));
const SLEEP_DATA = [
  { stage: 'Awake', mins: 18,  color: '#FF9500' },
  { stage: 'REM',   mins: 92,  color: '#007AFF' },
  { stage: 'Light', mins: 148, color: '#5AC8FA' },
  { stage: 'Deep',  mins: 82,  color: '#1C1C6E' },
];

function openLink(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

// ── Chevron ───────────────────────────────────────────────────────────────
const Chevron = ({ color = 'rgba(60,60,67,0.30)' }: { color?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" width="16" height="16" style={{ color, flexShrink: 0 }}>
    <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

// ── Activity ring ─────────────────────────────────────────────────────────
function ActivityRing({ r, pct, color, label, value, unit, size = 44 }: {
  r: number; pct: number; color: string; label: string; value: string; unit: string; size?: number;
}) {
  const circum = 2 * Math.PI * r;
  const ringRef = useRef<SVGCircleElement>(null);
  useEffect(() => {
    if (!ringRef.current) return;
    gsap.fromTo(ringRef.current,
      { strokeDashoffset: circum },
      { strokeDashoffset: circum * (1 - pct), duration: 1.4, ease: 'power3.out', delay: 0.3 }
    );
  }, [circum, pct]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeOpacity={0.15} strokeWidth={5}/>
          <circle ref={ringRef} cx={size/2} cy={size/2} r={r} fill="none" stroke={color}
            strokeWidth={5} strokeLinecap="round"
            strokeDasharray={`${circum}`} strokeDashoffset={circum}/>
        </svg>
        <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color }}>{Math.round(pct * 100)}%</span>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.5)' }}>{unit}</div>
        <div style={{ fontSize: 10, color, fontWeight: 600, marginTop: 1 }}>{label}</div>
      </div>
    </div>
  );
}

// ── Watch strip ───────────────────────────────────────────────────────────
function WatchStrip({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <section className="app-section">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <h2 className="app-section-title" style={{ margin: 0 }}>Activity</h2>
        <button onClick={() => onOpen('watch')} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(0,122,255,0.10)', border: 'none', color: '#007AFF',
          fontSize: 14, fontWeight: 600,
          cursor: 'pointer', padding: '8px 14px', borderRadius: 20,
          fontFamily: 'inherit',
        }}>
          <IcoWatch size={15} /> Details
        </button>
      </div>
      <div className="app-card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-start' }}>
          <ActivityRing r={17} pct={0.72} color="#FF375F" label="Move"     value="432" unit="cal" size={44}/>
          <ActivityRing r={17} pct={0.85} color="#4CD964" label="Exercise" value="34"  unit="min" size={44}/>
          <ActivityRing r={17} pct={0.58} color="#5AC8FA" label="Stand"    value="7"   unit="hrs" size={44}/>
        </div>
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
          {[
            { icon: <IcoSteps size={14} />, val: '6,241', lbl: 'Steps',    color: '#007AFF' },
            { icon: <IcoHeart size={14} />, val: '71',    lbl: 'BPM',      color: '#FF375F' },
            { icon: <IcoFlame size={14} />, val: '1,840', lbl: 'Calories', color: '#FF9500' },
            { icon: <IcoMoon  size={14} />, val: '6h 52m',lbl: 'Sleep',    color: '#5AC8FA' },
          ].map(s => (
            <div key={s.lbl} style={{ textAlign: 'center' }}>
              <span style={{ color: s.color, display: 'flex', justifyContent: 'center', marginBottom: 2 }}>{s.icon}</span>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1C1C1E', lineHeight: 1.2 }}>{s.val}</div>
              <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)' }}>{s.lbl}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Watch detail panel content ─────────────────────────────────────────────
function WatchDetailPanel() {
  return (
    <div className="panel-scroll-inner" style={{ gap: 16 }}>
      <div className="app-card" style={{ padding: 16 }}>
        <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: 'rgba(60,60,67,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Today's Rings</p>
        <div style={{ display: 'flex', justifyContent: 'space-around' }}>
          <ActivityRing r={20} pct={0.72} color="#FF375F" label="Move"     value="432" unit="cal / 600 goal" size={54}/>
          <ActivityRing r={20} pct={0.85} color="#4CD964" label="Exercise" value="34"  unit="min / 40 goal"  size={54}/>
          <ActivityRing r={20} pct={0.58} color="#5AC8FA" label="Stand"    value="7"   unit="hrs / 12 goal"  size={54}/>
        </div>
      </div>
      <div className="app-card" style={{ padding: 16 }}>
        <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: 'rgba(60,60,67,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Heart Rate · 24h</p>
        <HeartRateChart />
      </div>
      <div className="app-card" style={{ padding: 16 }}>
        <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: 'rgba(60,60,67,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Steps · This Week</p>
        <StepsChart />
      </div>
      <div className="app-card" style={{ padding: 16 }}>
        <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: 'rgba(60,60,67,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sleep · Last Night</p>
        <SleepChart />
      </div>
      <div className="app-card-group">
        {[
          { label: 'Resting Heart Rate', val: '58 BPM', sub: 'Optimal range: 50–70' },
          { label: 'VO₂ Max', val: '32.4',  sub: 'Fitness estimate' },
          { label: 'Walking Steadiness', val: 'OK', sub: 'Apple Watch metric' },
          { label: 'Blood Oxygen', val: '97%', sub: 'SpO₂ overnight avg' },
        ].map((r, i) => (
          <div key={i} className="app-card-row" style={{ cursor: 'default' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#1C1C1E' }}>{r.label}</div>
              <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.5)', marginTop: 1 }}>{r.sub}</div>
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#007AFF' }}>{r.val}</span>
          </div>
        ))}
      </div>
      <button className="panel-primary-btn" onClick={() => openLink('https://www.apple.com/apple-watch/health/')}>
        Learn more about Apple Watch health features
      </button>
    </div>
  );
}

// ── Articles panel ────────────────────────────────────────────────────────
function ArticlesPanel() {
  return (
    <div className="panel-scroll-inner">
      <p style={{ margin: '0 0 4px', fontSize: 13, color: 'rgba(60,60,67,0.5)' }}>
        Curated from trusted health institutions. Tap any article to open in your browser.
      </p>
      {ARTICLES.map((a, i) => (
        <button key={i} onClick={() => openLink(a.url)} style={{
          display: 'flex', alignItems: 'flex-start', gap: 14,
          background: '#FFFFFF', borderRadius: 14, padding: '14px 16px',
          border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
          boxShadow: '0 1px 0 rgba(60,60,67,0.10), 0 1px 4px rgba(0,0,0,0.06)',
          fontFamily: 'inherit',
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, background: a.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            {a.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: a.color, background: `${a.color}18`, borderRadius: 5, padding: '2px 6px' }}>{a.tag}</span>
              <span style={{ fontSize: 11, color: 'rgba(60,60,67,0.40)' }}>{a.time}</span>
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#1C1C1E', margin: '0 0 4px', lineHeight: 1.35 }}>{a.title}</p>
            <p style={{ fontSize: 12, color: 'rgba(60,60,67,0.55)', margin: '0 0 4px', lineHeight: 1.4 }}>{a.summary}</p>
            <span style={{ fontSize: 11, color: 'rgba(60,60,67,0.40)', display: 'flex', alignItems: 'center', gap: 3 }}>
              {a.source} <IcoExternal size={10} />
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

// ── Charts ────────────────────────────────────────────────────────────────
function StepsChart() {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.5)' }}>Avg: 5,971 / day</span>
        <span style={{ fontSize: 22, fontWeight: 700, color: '#007AFF' }}>6,241 <span style={{ fontSize: 12, fontWeight: 400, color: 'rgba(60,60,67,0.45)' }}>today</span></span>
      </div>
      <ResponsiveContainer width="100%" height={80}>
        <BarChart data={STEPS_DATA} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
          <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'rgba(60,60,67,0.45)' }} axisLine={false} tickLine={false}/>
          <YAxis hide/>
          <Tooltip contentStyle={{ background: '#1C1C1E', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }} formatter={(v: number) => [v.toLocaleString(), 'steps']} labelStyle={{ color: 'rgba(255,255,255,0.6)' }}/>
          <Bar dataKey="steps" fill="#007AFF" radius={[4, 4, 0, 0]} maxBarSize={28}/>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
function HeartRateChart() {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)' }}>Range: <span style={{ color: '#1C1C1E', fontWeight: 600 }}>55–88 BPM</span></span>
        <span style={{ fontSize: 22, fontWeight: 700, color: '#FF375F' }}>71 <span style={{ fontSize: 12, fontWeight: 400, color: 'rgba(60,60,67,0.45)' }}>BPM</span></span>
      </div>
      <ResponsiveContainer width="100%" height={72}>
        <AreaChart data={HR_DATA} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
          <defs>
            <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF375F" stopOpacity={0.25}/>
              <stop offset="100%" stopColor="#FF375F" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis dataKey="h" tick={{ fontSize: 9, fill: 'rgba(60,60,67,0.40)' }} tickFormatter={v => v % 6 === 0 ? `${v}:00` : ''} axisLine={false} tickLine={false}/>
          <YAxis hide domain={[50, 100]}/>
          <Tooltip contentStyle={{ background: '#1C1C1E', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }} formatter={(v: number) => [v, 'BPM']} labelFormatter={h => `${h}:00`}/>
          <Area type="monotone" dataKey="bpm" stroke="#FF375F" strokeWidth={2} fill="url(#hrGrad)" dot={false}/>
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
function SleepChart() {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)' }}>Bedtime 10:34 PM → 6:21 AM</span>
        <span style={{ fontSize: 20, fontWeight: 700, color: '#1C1C6E' }}>6h 52m</span>
      </div>
      <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', height: 12, marginBottom: 10 }}>
        {SLEEP_DATA.map(d => <div key={d.stage} style={{ flex: d.mins, background: d.color }}/>)}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {SLEEP_DATA.map(d => (
          <div key={d.stage} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color }}/>
            <span style={{ fontSize: 11, color: 'rgba(60,60,67,0.55)' }}>{d.stage}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#1C1C1E' }}>{Math.floor(d.mins / 60)}h {d.mins % 60}m</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Walk map ──────────────────────────────────────────────────────────────
function WalkMap() {
  return (
    <div className="app-card" style={{ overflow: 'hidden', position: 'relative', minHeight: 160 }}>
      <svg viewBox="0 0 360 160" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <rect width="360" height="160" fill="#E8F0E4"/>
        {[[10,10,80,60],[100,10,80,60],[190,10,80,60],[280,10,70,60],
          [10,80,80,70],[100,80,80,70],[280,80,70,70]].map(([x,y,w,h],i) => (
          <rect key={i} x={x} y={y} width={w} height={h} fill="#F0EDE8" rx="3"/>
        ))}
        <rect x="190" y="80" width="80" height="70" fill="#C8E6C0" rx="3"/>
        <text x="230" y="118" textAnchor="middle" fontSize="8" fill="#4CAF50" fontWeight="600">Park</text>
        <rect x="0" y="68" width="360" height="12" fill="#FFFFFF"/>
        <rect x="90" y="0" width="12" height="160" fill="#FFFFFF"/>
        <rect x="180" y="0" width="12" height="160" fill="#FFFFFF"/>
        <rect x="270" y="0" width="12" height="160" fill="#FFFFFF"/>
        <path d="M 30 144 L 30 74 L 96 74 L 96 26 L 186 26 L 186 74 L 276 74 L 276 144"
          fill="none" stroke="#007AFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray="8 4" opacity={0.85}/>
        <circle cx="30" cy="144" r="6" fill="#34C759"/>
        <circle cx="30" cy="144" r="3" fill="#fff"/>
        <circle cx="276" cy="144" r="6" fill="#007AFF"/>
        <circle cx="276" cy="144" r="3" fill="#fff"/>
      </svg>
      <div style={{ position: 'absolute', top: 10, left: 10, right: 10, display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)', borderRadius: 10, padding: '6px 10px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1C1C1E', display: 'flex', alignItems: 'center', gap: 5 }}>
            <IcoWalk color="#34C759" size={13}/> Morning Walk
          </div>
          <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.55)' }}>Today · 9:14 AM</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)', borderRadius: 10, padding: '6px 10px', textAlign: 'right' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#007AFF' }}>1.2 mi</div>
          <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.55)' }}>24 min</div>
        </div>
      </div>
    </div>
  );
}

// ── Recommendations carousel ──────────────────────────────────────────────
function RecommendationsSection({ onOpenArticles }: { onOpenArticles: () => void }) {
  return (
    <section className="app-section">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <h2 className="app-section-title" style={{ margin: 0 }}>For You</h2>
        <button onClick={onOpenArticles} style={{
          background: 'none', border: 'none', color: '#007AFF', fontSize: 13, fontWeight: 500,
          cursor: 'pointer', padding: 0, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 3,
        }}>See all <IcoExternal size={11} /></button>
      </div>
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
        {ARTICLES.slice(0, 6).map((a, i) => (
          <button key={i} onClick={() => openLink(a.url)} style={{
            flexShrink: 0, width: 200, background: '#FFFFFF', borderRadius: 14,
            boxShadow: '0 1px 0 rgba(60,60,67,0.10), 0 1px 4px rgba(0,0,0,0.06)',
            overflow: 'hidden', border: 'none', cursor: 'pointer', textAlign: 'left',
            padding: 0, fontFamily: 'inherit',
          }}>
            <div style={{ background: a.bg, padding: '16px 14px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {a.icon}
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: a.color, background: `${a.color}18`, borderRadius: 5, padding: '2px 6px' }}>{a.tag}</span>
            </div>
            <div style={{ padding: '10px 14px 12px' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E', margin: '0 0 5px', lineHeight: 1.35 }}>{a.title}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'rgba(60,60,67,0.50)' }}>{a.source}</span>
                <span style={{ fontSize: 11, color: 'rgba(60,60,67,0.40)', display: 'flex', alignItems: 'center', gap: 2 }}><IcoExternal size={9}/></span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

// ── Health tips ───────────────────────────────────────────────────────────
function HealthTips() {
  return (
    <section className="app-section">
      <h2 className="app-section-title">Today's Tips</h2>
      <div className="app-card-group">
        {TIPS.map((t, i) => (
          <button key={i} className="app-card-row tip-row" onClick={() => openLink(t.url)} style={{ width: '100%', background: 'transparent', border: 'none', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {t.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1C1C1E', marginBottom: 2 }}>{t.title}</div>
              <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.55)' }}>{t.sub}</div>
            </div>
            <IcoExternal size={11} />
          </button>
        ))}
      </div>
    </section>
  );
}

// ── Today tab ─────────────────────────────────────────────────────────────
function TodayTab({ events, medications, acseScore, onOpen, onClara }: {
  events: Event[]; medications: Medication[]; acseScore: number; onOpen: (id: string) => void; onClara: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scoreRingRef = useRef<SVGCircleElement>(null);
  const scoreNumRef = useRef<HTMLSpanElement>(null);
  const now = new Date();
  const dueMeds = medications.filter(m => isMedicationDueSoon(m.schedule));
  const upcoming = events
    .filter(e => !e.completed && new Date(e.timestamp) > now)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(0, 4);
  const scoreColor = acseScore >= 80 ? '#34C759' : acseScore >= 60 ? '#FF9500' : '#FF3B30';
  const dateStr = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  useEffect(() => {
    const circum = 138.2;
    if (scoreRingRef.current) {
      gsap.fromTo(scoreRingRef.current,
        { strokeDashoffset: circum },
        { strokeDashoffset: circum * (1 - acseScore / 100), duration: 1.5, ease: 'power3.out', delay: 0.35 }
      );
    }
    if (scoreNumRef.current) {
      const obj = { val: 0 };
      gsap.to(obj, { val: acseScore, duration: 1.3, ease: 'power2.out', delay: 0.35,
        onUpdate: () => { if (scoreNumRef.current) scoreNumRef.current.textContent = String(Math.round(obj.val)); } });
    }
  }, [acseScore]);

  useEffect(() => {
    if (!containerRef.current) return;
    const sections = containerRef.current.querySelectorAll<HTMLElement>('.app-section');
    gsap.set(sections, { opacity: 0, y: 24 });
    ScrollTrigger.batch(sections, {
      scroller: containerRef.current,
      onEnter: els => gsap.to(els, { opacity: 1, y: 0, duration: 0.5, stagger: 0.07, ease: 'power2.out', overwrite: 'auto' }),
      start: 'top 95%',
    });
    return () => ScrollTrigger.getAll().forEach(t => t.kill());
  }, []);

  return (
    <div ref={containerRef} className="tab-scroll">
      <div className="tab-date-header">{dateStr}</div>

      <WatchStrip onOpen={onOpen} />

      <section className="app-section">
        <h2 className="app-section-title">Cognitive Health</h2>
        <div className="app-card score-card" onClick={() => onOpen('memory')} style={{ cursor: 'pointer' }}>
          <div className="score-card__ring-wrap">
            <svg viewBox="0 0 56 56" width="56" height="56">
              <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(60,60,67,0.10)" strokeWidth="5"/>
              <circle ref={scoreRingRef} cx="28" cy="28" r="22" fill="none" stroke={scoreColor} strokeWidth="5"
                strokeDasharray="138.2 138.2" strokeDashoffset="138.2"
                strokeLinecap="round" transform="rotate(-90 28 28)"/>
            </svg>
            <span ref={scoreNumRef} className="score-card__number" style={{ color: scoreColor }}>0</span>
          </div>
          <div className="score-card__text">
            <p className="score-card__label">ACSE Score</p>
            <p className="score-card__sublabel">{acseScore >= 80 ? 'Looking great today' : acseScore >= 60 ? 'Moderate — keep going' : 'Needs attention'}</p>
          </div>
          <Chevron />
        </div>
      </section>

      <section className="app-section">
        <h2 className="app-section-title">Medications</h2>
        <div className="app-card-group">
          {dueMeds.length === 0 ? (
            <div className="app-card-row app-card-row--single">
              <span className="row-icon row-icon--green"><svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M5 12l4 4 10-9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
              <span className="row-text">All medications up to date</span>
            </div>
          ) : dueMeds.slice(0, 3).map(med => (
            <div key={med.name} className="app-card-row" onClick={() => onOpen('meds')}>
              <span className="row-icon row-icon--orange"><IcoPill color="#EA6C00" size={16}/></span>
              <span className="row-text">{med.name}</span>
              <span className="row-badge row-badge--orange">Due now</span>
            </div>
          ))}
          <div className="app-card-row app-card-row--action" onClick={() => onOpen('meds')}>
            <span className="row-text" style={{ color: '#007AFF' }}>View all medications</span><Chevron color="#007AFF" />
          </div>
        </div>
      </section>

      <section className="app-section">
        <h2 className="app-section-title">Coming Up</h2>
        <div className="app-card-group">
          {upcoming.length === 0 ? (
            <div className="app-card-row app-card-row--single">
              <span className="row-text" style={{ color: 'rgba(60,60,67,0.45)' }}>Nothing scheduled — enjoy your day</span>
            </div>
          ) : upcoming.map(ev => (
            <div key={ev.id} className="app-card-row">
              <span className="row-icon row-icon--blue"><IcoCalendar color="#007AFF" size={16}/></span>
              <span className="row-text">{ev.title}</span>
              <span className="row-time">{new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="app-section">
        <h2 className="app-section-title">Health Charts</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="app-card" style={{ padding: '16px 14px 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <span style={{ color: '#007AFF' }}><IcoSteps size={14}/></span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E' }}>Steps</span>
              <span style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)' }}>Last 7 days</span>
            </div>
            <StepsChart />
          </div>
          <div className="app-card" style={{ padding: '16px 14px 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ color: '#FF375F' }}><IcoHeart size={14}/></span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E' }}>Heart Rate</span>
              <span style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)' }}>24h</span>
            </div>
            <HeartRateChart />
          </div>
          <div className="app-card" style={{ padding: '16px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <span style={{ color: '#1C1C6E' }}><IcoMoon size={14}/></span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E' }}>Sleep</span>
              <span style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)' }}>Last night</span>
            </div>
            <SleepChart />
          </div>
        </div>
      </section>

      <section className="app-section">
        <h2 className="app-section-title">Last Walk</h2>
        <WalkMap />
      </section>

      <section className="app-section">
        <h2 className="app-section-title">Quick Actions</h2>
        <div className="quick-action-row">
          <button className="quick-action-btn quick-action-btn--blue tap-feedback" onClick={onClara} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IcoMic color="#fff" size={20}/> Talk to Clara
          </button>
          <button className="quick-action-btn quick-action-btn--red tap-feedback" onClick={() => onOpen('safety')} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IcoShield color="#fff" size={20}/> Safety
          </button>
        </div>
      </section>

      <RecommendationsSection onOpenArticles={() => onOpen('articles')} />
      <HealthTips />
      <div style={{ height: 32 }} />
    </div>
  );
}

// ── Care tab ──────────────────────────────────────────────────────────────
function CareTab({ onOpen }: { onOpen: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const items = ref.current.querySelectorAll<HTMLElement>('.app-section');
    gsap.fromTo(items, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.45, stagger: 0.08, ease: 'power2.out' });
  }, []);
  return (
    <div ref={ref} className="tab-scroll">
      <section className="app-section">
        <h2 className="app-section-title">Medications</h2>
        <div className="app-card-group">
          <div className="app-card-nav-row" onClick={() => onOpen('meds')}>
            <span className="nav-row-icon" style={{ background: '#FFF3E5' }}><IcoPill color="#EA6C00" size={20}/></span>
            <div className="nav-row-body">
              <span className="nav-row-label">Medication Tracker</span>
              <span className="nav-row-sub">Log & track all medications</span>
            </div>
            <Chevron />
          </div>
        </div>
      </section>
      <section className="app-section">
        <h2 className="app-section-title">Mind</h2>
        <div className="app-card-group">
          <div className="app-card-nav-row" onClick={() => onOpen('games')}>
            <span className="nav-row-icon" style={{ background: '#F3EEFF' }}><IcoGrid color="#7C3AED" size={20}/></span>
            <div className="nav-row-body">
              <span className="nav-row-label">Mind Games</span>
              <span className="nav-row-sub">Wordle, Sudoku & more</span>
            </div>
            <Chevron />
          </div>
          <div className="app-card-nav-row" onClick={() => onOpen('memory')}>
            <span className="nav-row-icon" style={{ background: '#F3EEFF' }}><IcoBrain color="#7C3AED" size={20}/></span>
            <div className="nav-row-body">
              <span className="nav-row-label">Memory Dashboard</span>
              <span className="nav-row-sub">Cognitive score & recap</span>
            </div>
            <Chevron />
          </div>
        </div>
      </section>
      <section className="app-section">
        <h2 className="app-section-title">People</h2>
        <div className="app-card-group">
          <div className="app-card-nav-row" onClick={() => onOpen('faces')}>
            <span className="nav-row-icon" style={{ background: '#E5F6FB' }}><IcoUsers color="#0891B2" size={20}/></span>
            <div className="nav-row-body">
              <span className="nav-row-label">Familiar Faces</span>
              <span className="nav-row-sub">Friends and family</span>
            </div>
            <Chevron />
          </div>
          <div className="app-card-nav-row" onClick={() => onOpen('safety')}>
            <span className="nav-row-icon" style={{ background: '#FFEBEA' }}><IcoShield color="#DC2626" size={20}/></span>
            <div className="nav-row-body">
              <span className="nav-row-label">Safety Circle</span>
              <span className="nav-row-sub">Emergency contacts & SOS</span>
            </div>
            <Chevron />
          </div>
        </div>
      </section>
      <section className="app-section">
        <h2 className="app-section-title">Learn</h2>
        <div className="app-card-group">
          {[
            { icon: <IcoPill color="#EA6C00" size={20}/>, bg: '#FFF3E5', label: 'Medication safety guide', sub: 'NIH on Aging', url: 'https://www.nia.nih.gov/health/safe-use-medicines-older-adults' },
            { icon: <IcoHeart color="#FF375F" size={20}/>, bg: '#FFF0F3', label: 'Heart health & dementia risk', sub: 'Mayo Clinic', url: 'https://www.mayoclinic.org/diseases-conditions/alzheimers-disease/in-depth/alzheimers-prevention/art-20048560' },
            { icon: <IcoLeaf color="#16A34A" size={20}/>, bg: '#E8F5E9', label: 'The MIND diet explained', sub: 'Cleveland Clinic', url: 'https://health.clevelandclinic.org/what-is-mind-diet' },
          ].map((row, i) => (
            <div key={i} className="app-card-nav-row" onClick={() => openLink(row.url)}>
              <span className="nav-row-icon" style={{ background: row.bg }}>{row.icon}</span>
              <div className="nav-row-body">
                <span className="nav-row-label">{row.label}</span>
                <span className="nav-row-sub">{row.sub}</span>
              </div>
              <IcoExternal size={13} />
            </div>
          ))}
        </div>
      </section>
      <div style={{ height: 24 }} />
    </div>
  );
}

// ── Mind tab ──────────────────────────────────────────────────────────────
function MindTab({ onOpen }: { onOpen: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const items = ref.current.querySelectorAll<HTMLElement>('.app-section');
    gsap.fromTo(items, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.45, stagger: 0.08, ease: 'power2.out' });
  }, []);
  return (
    <div ref={ref} className="tab-scroll">
      <section className="app-section">
        <h2 className="app-section-title">Your AI Companion</h2>
        <div className="clara-hero-card tap-feedback" onClick={() => onOpen('voice')}>
          <div className="clara-hero-card__icon">
            <svg viewBox="0 0 64 64" fill="none" width="48" height="48">
              <circle cx="32" cy="26" r="12" fill="white" fillOpacity="0.95"/>
              <path d="M10 58c0-12.2 9.8-22 22-22s22 9.8 22 22" fill="white" fillOpacity="0.88"/>
              <path d="M50 30c3-4 3-11 0-15" stroke="white" strokeOpacity="0.75" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="clara-hero-card__body">
            <p className="clara-hero-card__name">Clara</p>
            <p className="clara-hero-card__sub">Your AI memory companion</p>
          </div>
          <div className="clara-hero-card__cta" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <IcoMic color="rgba(255,255,255,0.90)" size={16}/> Talk now
          </div>
        </div>
      </section>
      <section className="app-section">
        <h2 className="app-section-title">Activities</h2>
        <div className="app-card-group">
          <div className="app-card-nav-row" onClick={() => onOpen('games')}>
            <span className="nav-row-icon" style={{ background: '#F3EEFF' }}><IcoGrid color="#7C3AED" size={20}/></span>
            <div className="nav-row-body">
              <span className="nav-row-label">Mind Games</span>
              <span className="nav-row-sub">Wordle, Sudoku & more</span>
            </div>
            <Chevron />
          </div>
          <div className="app-card-nav-row" onClick={() => onOpen('memory')}>
            <span className="nav-row-icon" style={{ background: '#F3EEFF' }}><IcoBrain color="#7C3AED" size={20}/></span>
            <div className="nav-row-body">
              <span className="nav-row-label">Memory Dashboard</span>
              <span className="nav-row-sub">Cognitive score & recap</span>
            </div>
            <Chevron />
          </div>
        </div>
      </section>
      <section className="app-section">
        <h2 className="app-section-title">Brain Health Reading</h2>
        <div className="app-card-group">
          {[
            { icon: <IcoBrain color="#7C3AED" size={20}/>, bg: '#F3EEFF', label: 'How exercise protects memory', sub: 'Harvard Health', url: 'https://www.health.harvard.edu/mind-and-mood/regular-exercise-changes-the-brain-to-improve-memory-thinking-skills' },
            { icon: <IcoUsers color="#DB2777" size={20}/>, bg: '#FDE8F3', label: 'Social connection & brain health', sub: 'Alzheimer\'s Assoc.', url: 'https://www.alz.org/help-support/brain_health/10_ways_to_love_your_brain' },
            { icon: <IcoRun color="#0891B2" size={20}/>, bg: '#E5F6FB', label: 'Exercise for older adults', sub: 'NIH on Aging', url: 'https://www.nia.nih.gov/health/exercise-physical-activity' },
          ].map((row, i) => (
            <div key={i} className="app-card-nav-row" onClick={() => openLink(row.url)}>
              <span className="nav-row-icon" style={{ background: row.bg }}>{row.icon}</span>
              <div className="nav-row-body">
                <span className="nav-row-label">{row.label}</span>
                <span className="nav-row-sub">{row.sub}</span>
              </div>
              <IcoExternal size={13} />
            </div>
          ))}
        </div>
      </section>
      <div style={{ height: 24 }} />
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────
function Panel({ id, panelRef, onClose, user }: {
  id: string; panelRef: React.RefObject<HTMLDivElement>; onClose: () => void; user: User | null;
}) {
  const { triggerMemoryRecap } = useAppStore();
  return (
    <div ref={panelRef} className="app-panel">
      <div className="app-panel-header">
        <button className="app-back-btn" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" width="20" height="20"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Back
        </button>
        <span className="app-panel-title">{PANEL_TITLES[id] ?? id}</span>
        <div style={{ width: 60 }} />
      </div>
      <div className="app-panel-content">
        {id === 'voice'    && <VoiceAgent />}
        {id === 'meds'     && <MedTracker />}
        {id === 'games'    && <GameHub />}
        {id === 'watch'    && <WatchDetailPanel />}
        {id === 'articles' && <ArticlesPanel />}
        {id === 'memory'   && (
          <div className="panel-scroll-inner">
            <StateReconCard />
            <WhereAmICard />
            <ACSEDashboard />
            <button className="panel-primary-btn tap-feedback" onClick={() => triggerMemoryRecap('manual')}>
              Start memory recap
            </button>
          </div>
        )}
        {id === 'safety' && <div className="panel-scroll-inner"><SafetyCircle /></div>}
        {id === 'faces'  && <div className="panel-scroll-inner"><FamiliarFaces /></div>}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────
export default function PatientView() {
  const [tab, setTab] = useState<PatientTab>('today');
  const [panel, setPanel] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { user, acseScore, demoMode, setDemoMode } = useAppStore();
  const { recordNavigation } = useACSE();
  const setScreen = useAppStore(s => s.setScreen);
  const panelRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  const events = useLiveQuery<Event[]>(
    () => user?.id ? db.events.where('userId').equals(user.id).sortBy('timestamp') : Promise.resolve([]),
    [user?.id]
  ) ?? [];
  const medications: Medication[] = user?.medications ?? [];
  const firstName = user?.name?.split(' ')[0] ?? 'there';

  useEffect(() => {
    if (!panelRef.current || !panel) return;
    gsap.fromTo(panelRef.current, { x: '100%', opacity: 0.8 }, { x: '0%', opacity: 1, duration: 0.36, ease: 'power3.out' });
  }, [panel]);

  const handleTabChange = useCallback((t: PatientTab) => {
    if (t === tab) return;
    if (mainRef.current) gsap.fromTo(mainRef.current, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' });
    setTab(t);
    recordNavigation();
  }, [tab, recordNavigation]);

  const openPanel = (id: string) => { recordNavigation(); setPanel(id); };
  const closePanel = () => {
    if (panelRef.current) {
      gsap.to(panelRef.current, { x: '100%', opacity: 0.7, duration: 0.28, ease: 'power2.in', onComplete: () => setPanel(null) });
    } else setPanel(null);
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  if (panel) return (
    <>
      <Panel id={panel} panelRef={panelRef} onClose={closePanel} user={user} />
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <MemoryPhotoRecap />
    </>
  );

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="app-header__eyebrow">{greeting}</p>
          <h1 className="app-header__name">{firstName}</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="app-header__score-pill" title="Cognitive score">
            <span className="app-header__score-dot" style={{ background: acseScore >= 80 ? '#34C759' : acseScore >= 60 ? '#FF9500' : '#FF3B30' }} />
            {acseScore}
          </div>
          <button className="app-header__avatar tap-feedback" onClick={() => setScreen('login')} title="Switch user">
            {firstName.charAt(0).toUpperCase()}
          </button>
        </div>
      </header>

      <main ref={mainRef} className="app-main">
        {tab === 'today'   && <TodayTab events={events} medications={medications} acseScore={acseScore} onOpen={openPanel} onClara={() => handleTabChange('clara')} />}
        {tab === 'care'    && <CareTab onOpen={openPanel} />}
        {tab === 'clara'   && <VoiceAgent />}
        {tab === 'routine' && <div className="tab-scroll"><RoutineChecklist /></div>}
      </main>

      <nav className="app-tab-bar">
        {([
          { id: 'today',   label: 'Today',   icon: <IcoToday /> },
          { id: 'care',    label: 'Care',    icon: <IcoCare /> },
          { id: 'clara',   label: 'Clara',   icon: <IcoClara /> },
          { id: 'routine', label: 'Routine', icon: <IcoRoutine /> },
        ] as const).map(t => (
          <button key={t.id} className={`app-tab${tab === t.id ? ' app-tab--active' : ''}`}
            onClick={() => handleTabChange(t.id as PatientTab)}>
            <span className="app-tab__icon">{t.icon}</span>
            <span className="app-tab__label">{t.label}</span>
          </button>
        ))}
      </nav>

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <MemoryPhotoRecap />
      {demoMode && <GoldenPathDemo onNavigate={openPanel} onClose={() => setDemoMode(false)} />}
    </div>
  );
}
