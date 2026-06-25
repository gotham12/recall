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

type PatientTab = 'today' | 'care' | 'mind' | 'routine';

const PANEL_TITLES: Record<string, string> = {
  voice: 'Clara',
  meds: 'Medications',
  games: 'Mind Games',
  memory: 'Memory',
  safety: 'Safety Circle',
  faces: 'Familiar Faces',
  events: "Today's Events",
};

// ── Seeded pseudo-random chart data ────────────────────────────────────────
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const STEPS_DATA = [4200, 6800, 5100, 7400, 3900, 8100, 6200].map((v, i) => ({ day: DAYS[i], steps: v }));
const HR_DATA = Array.from({ length: 24 }, (_, i) => ({
  h: i,
  bpm: 55 + Math.round(20 * Math.sin((i - 6) * 0.4) + 8 * Math.sin(i * 1.1) + (i > 7 && i < 20 ? 12 : 0)),
}));
const SLEEP_DATA = [
  { stage: 'Awake', mins: 18, color: '#FF9500' },
  { stage: 'REM',   mins: 92, color: '#007AFF' },
  { stage: 'Light', mins: 148, color: '#5AC8FA' },
  { stage: 'Deep',  mins: 82, color: '#1C1C6E' },
];

// ── SVG icons ────────────────────────────────────────────────────────────────
const Chevron = () => (
  <svg viewBox="0 0 24 24" fill="none" width="16" height="16" style={{ color: 'rgba(60,60,67,0.30)', flexShrink: 0 }}>
    <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
function IcoToday() {
  return <svg viewBox="0 0 24 24" fill="none" width="26" height="26"><rect x="3" y="4" width="18" height="17" rx="3.5" stroke="currentColor" strokeWidth="1.7"/><line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" strokeWidth="1.7"/><line x1="8" y1="2.5" x2="8" y2="5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><line x1="16" y1="2.5" x2="16" y2="5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><circle cx="12" cy="15" r="1.2" fill="currentColor"/></svg>;
}
function IcoCare() {
  return <svg viewBox="0 0 24 24" fill="none" width="26" height="26"><path d="M12 21s-7-5-7-10.5A5.5 5.5 0 0 1 12 5.5 5.5 5.5 0 0 1 19 10.5C19 16 12 21 12 21z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function IcoMind() {
  return <svg viewBox="0 0 24 24" fill="none" width="26" height="26"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7"/><path d="M9 12c0-1.65 1.34-3 3-3s3 1.35 3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><line x1="12" y1="15" x2="12" y2="17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>;
}
function IcoRoutine() {
  return <svg viewBox="0 0 24 24" fill="none" width="26" height="26"><path d="M5 12l4 4 10-9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

// ── Apple Watch Activity Rings ───────────────────────────────────────────────
function ActivityRing({ r, pct, color, label, value, unit, size = 44 }: {
  r: number; pct: number; color: string; label: string; value: string; unit: string; size?: number;
}) {
  const circum = 2 * Math.PI * r;
  const ringRef = useRef<SVGCircleElement>(null);
  useEffect(() => {
    if (!ringRef.current) return;
    gsap.fromTo(ringRef.current,
      { strokeDashoffset: circum },
      { strokeDashoffset: circum * (1 - pct), duration: 1.4, ease: 'power3.out', delay: 0.2 }
    );
  }, [circum, pct]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeOpacity={0.15} strokeWidth={5}/>
          <circle ref={ringRef} cx={size/2} cy={size/2} r={r} fill="none" stroke={color}
            strokeWidth={5} strokeLinecap="round"
            strokeDasharray={`${circum}`}
            strokeDashoffset={circum}
          />
        </svg>
        <span style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color,
        }}>{Math.round(pct * 100)}%</span>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.5)', lineHeight: 1.3 }}>{unit}</div>
        <div style={{ fontSize: 10, color, fontWeight: 600, marginTop: 1 }}>{label}</div>
      </div>
    </div>
  );
}

// ── Apple Watch Summary Strip ────────────────────────────────────────────────
function WatchStrip() {
  const now = new Date();
  const dayPct = (now.getHours() * 60 + now.getMinutes()) / (24 * 60);
  return (
    <section className="app-section watch-strip-section">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <h2 className="app-section-title" style={{ margin: 0 }}>Activity</h2>
        <span style={{ fontSize: 12, color: 'rgba(60,60,67,0.45)', fontWeight: 500 }}>
          <svg viewBox="0 0 24 24" fill="none" width="14" height="14" style={{ verticalAlign: 'middle', marginRight: 3 }}>
            <rect x="3" y="2" width="18" height="20" rx="5" stroke="#636366" strokeWidth="1.8"/>
            <rect x="9" y="0.5" width="6" height="3" rx="1.5" fill="#636366"/>
            <path d="M12 8v4l2.5 2.5" stroke="#636366" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          Apple Watch
        </span>
      </div>
      <div className="app-card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-start' }}>
          <ActivityRing r={17} pct={0.72} color="#FF375F" label="Move"     value="432" unit="cal"  size={44}/>
          <ActivityRing r={17} pct={0.85} color="#4CD964" label="Exercise" value="34"  unit="min"  size={44}/>
          <ActivityRing r={17} pct={0.58} color="#5AC8FA" label="Stand"    value="7"   unit="hrs"  size={44}/>
        </div>
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
          {[
            { icon: '👣', val: '6,241', lbl: 'Steps' },
            { icon: '❤️', val: '71',    lbl: 'BPM' },
            { icon: '🔥', val: '1,840', lbl: 'Calories' },
            { icon: '🛌', val: '6h 52m', lbl: 'Sleep' },
          ].map(s => (
            <div key={s.lbl} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16 }}>{s.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1C1C1E', lineHeight: 1.2, marginTop: 2 }}>{s.val}</div>
              <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)' }}>{s.lbl}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Steps bar chart ──────────────────────────────────────────────────────────
function StepsChart() {
  return (
    <div className="app-card" style={{ padding: '16px 12px 8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E' }}>Steps</span>
          <span style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', marginLeft: 6 }}>Last 7 days</span>
        </div>
        <span style={{ fontSize: 22, fontWeight: 700, color: '#007AFF' }}>6,241</span>
      </div>
      <ResponsiveContainer width="100%" height={80}>
        <BarChart data={STEPS_DATA} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
          <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'rgba(60,60,67,0.45)' }} axisLine={false} tickLine={false}/>
          <YAxis hide/>
          <Tooltip
            contentStyle={{ background: '#1C1C1E', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }}
            formatter={(v: number) => [v.toLocaleString(), 'steps']}
            labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
          />
          <Bar dataKey="steps" fill="#007AFF" radius={[4, 4, 0, 0]} maxBarSize={28}/>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Heart rate chart ─────────────────────────────────────────────────────────
function HeartRateChart() {
  return (
    <div className="app-card" style={{ padding: '16px 12px 8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 16 }}>❤️</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E' }}>Heart Rate</span>
          <span style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)' }}>24h</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: '#FF375F' }}>71</span>
          <span style={{ fontSize: 12, color: 'rgba(60,60,67,0.45)', marginLeft: 2 }}>BPM</span>
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', marginBottom: 4 }}>
        Range: <span style={{ color: '#1C1C1E', fontWeight: 600 }}>55–88 BPM</span>
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
          <Tooltip
            contentStyle={{ background: '#1C1C1E', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }}
            formatter={(v: number) => [v, 'BPM']}
            labelFormatter={h => `${h}:00`}
          />
          <Area type="monotone" dataKey="bpm" stroke="#FF375F" strokeWidth={2} fill="url(#hrGrad)" dot={false}/>
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Sleep chart ──────────────────────────────────────────────────────────────
function SleepChart() {
  const total = SLEEP_DATA.reduce((s, d) => s + d.mins, 0);
  return (
    <div className="app-card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 16 }}>🌙</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E' }}>Sleep</span>
          <span style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)' }}>Last night</span>
        </div>
        <span style={{ fontSize: 22, fontWeight: 700, color: '#1C1C6E' }}>6h 52m</span>
      </div>
      {/* Horizontal segmented bar */}
      <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', height: 12, marginBottom: 10 }}>
        {SLEEP_DATA.map(d => (
          <div key={d.stage} style={{ flex: d.mins, background: d.color }}/>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {SLEEP_DATA.map(d => (
          <div key={d.stage} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }}/>
            <span style={{ fontSize: 11, color: 'rgba(60,60,67,0.55)' }}>{d.stage}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#1C1C1E' }}>{Math.floor(d.mins / 60)}h {d.mins % 60}m</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Walking Map ──────────────────────────────────────────────────────────────
function WalkMap() {
  return (
    <div className="app-card walk-map-card" style={{ overflow: 'hidden', position: 'relative', minHeight: 160 }}>
      {/* SVG street map art */}
      <svg viewBox="0 0 360 160" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {/* Map background */}
        <rect width="360" height="160" fill="#E8F0E4"/>
        {/* Blocks */}
        {[[10,10,80,60],[100,10,80,60],[190,10,80,60],[280,10,70,60],
          [10,80,80,70],[100,80,80,70],[190,80,80,70],[280,80,70,70]].map(([x,y,w,h],i) => (
          <rect key={i} x={x} y={y} width={w} height={h} fill="#F0EDE8" rx="3"/>
        ))}
        {/* Park */}
        <rect x="190" y="80" width="80" height="70" fill="#C8E6C0" rx="3"/>
        <text x="230" y="118" textAnchor="middle" fontSize="8" fill="#4CAF50" fontWeight="600">Park</text>
        {/* Roads */}
        <rect x="0" y="68" width="360" height="12" fill="#FFFFFF"/>
        <rect x="90" y="0" width="12" height="160" fill="#FFFFFF"/>
        <rect x="180" y="0" width="12" height="160" fill="#FFFFFF"/>
        <rect x="270" y="0" width="12" height="160" fill="#FFFFFF"/>
        {/* Route */}
        <path d="M 30 144 L 30 74 L 96 74 L 96 26 L 186 26 L 186 74 L 276 74 L 276 144"
          fill="none" stroke="#007AFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray="8 4" opacity={0.85}/>
        {/* Start/end dots */}
        <circle cx="30" cy="144" r="6" fill="#34C759"/>
        <circle cx="30" cy="144" r="3" fill="#fff"/>
        <circle cx="276" cy="144" r="6" fill="#007AFF"/>
        <circle cx="276" cy="144" r="3" fill="#fff"/>
      </svg>
      {/* Overlay info */}
      <div style={{
        position: 'absolute', top: 10, left: 10, right: 10,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)',
          borderRadius: 10, padding: '6px 10px',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1C1C1E' }}>🚶 Morning Walk</div>
          <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.55)' }}>Today · 9:14 AM</div>
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)',
          borderRadius: 10, padding: '6px 10px', textAlign: 'right',
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#007AFF' }}>1.2 mi</div>
          <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.55)' }}>24 min</div>
        </div>
      </div>
    </div>
  );
}

// ── Health recommendations ───────────────────────────────────────────────────
const ARTICLES = [
  {
    emoji: '🧠',
    color: '#7C3AED',
    bg: '#F3EEFF',
    title: 'How Daily Walks Protect Memory',
    source: 'Harvard Health',
    time: '4 min read',
    tag: 'Brain Health',
  },
  {
    emoji: '💊',
    color: '#EA6C00',
    bg: '#FFF3E5',
    title: 'Best Times to Take Common Medications',
    source: 'Mayo Clinic',
    time: '6 min read',
    tag: 'Medications',
  },
  {
    emoji: '🛌',
    color: '#1C1C6E',
    bg: '#EEF0FF',
    title: 'Sleep and Cognitive Decline: What Research Says',
    source: 'NIH NIA',
    time: '5 min read',
    tag: 'Sleep',
  },
  {
    emoji: '🥗',
    color: '#16A34A',
    bg: '#E8F5E9',
    title: 'MIND Diet: Foods That Keep Your Brain Sharp',
    source: 'Cleveland Clinic',
    time: '7 min read',
    tag: 'Nutrition',
  },
  {
    emoji: '🏋️',
    color: '#0891B2',
    bg: '#E5F6FB',
    title: '20-Minute Strength Routines for Older Adults',
    source: 'Johns Hopkins',
    time: '5 min read',
    tag: 'Exercise',
  },
  {
    emoji: '🤝',
    color: '#DB2777',
    bg: '#FDE8F3',
    title: 'Social Connection as Medicine for Dementia',
    source: 'Alzheimer\'s Assoc.',
    time: '4 min read',
    tag: 'Wellness',
  },
];

function RecommendationsSection() {
  return (
    <section className="app-section reco-section">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <h2 className="app-section-title" style={{ margin: 0 }}>For You</h2>
        <span style={{ fontSize: 12, color: '#007AFF', fontWeight: 500 }}>See all</span>
      </div>
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, WebkitOverflowScrolling: 'touch' as any, scrollbarWidth: 'none' as any }}>
        {ARTICLES.map((a, i) => (
          <div key={i} className="reco-card" style={{
            flexShrink: 0, width: 200, background: '#FFFFFF', borderRadius: 14,
            boxShadow: '0 1px 0 rgba(60,60,67,0.10), 0 1px 4px rgba(0,0,0,0.06)',
            overflow: 'hidden',
          }}>
            <div style={{ background: a.bg, padding: '18px 16px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                fontSize: 26, width: 44, height: 44, borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.6)',
              }}>{a.emoji}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: a.color,
                background: `${a.color}18`, borderRadius: 6, padding: '3px 7px' }}>{a.tag}</span>
            </div>
            <div style={{ padding: '12px 14px 14px' }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#1C1C1E', margin: '0 0 6px', lineHeight: 1.35 }}>{a.title}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'rgba(60,60,67,0.50)' }}>{a.source}</span>
                <span style={{ fontSize: 11, color: 'rgba(60,60,67,0.40)' }}>{a.time}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Quick exercise tips (scroll reveal) ─────────────────────────────────────
const TIPS = [
  { emoji: '🚶', title: 'Walk 10 minutes after each meal', sub: 'Lowers blood sugar and aids digestion' },
  { emoji: '💧', title: 'Drink 8 glasses of water today', sub: 'Hydration supports cognitive function' },
  { emoji: '🧘', title: 'Try 5 minutes of deep breathing', sub: 'Reduces stress and improves focus' },
  { emoji: '🎵', title: 'Listen to familiar music', sub: 'Music therapy strengthens memory recall' },
];

function HealthTips() {
  return (
    <section className="app-section tips-section">
      <h2 className="app-section-title">Today's Tips</h2>
      <div className="app-card-group tips-group">
        {TIPS.map((t, i) => (
          <div key={i} className="app-card-row tip-row" style={{ gap: 12, padding: '13px 14px' }}>
            <span style={{
              fontSize: 20, width: 36, height: 36, borderRadius: 9, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#F2F2F7',
            }}>{t.emoji}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1C1C1E', marginBottom: 2 }}>{t.title}</div>
              <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.55)' }}>{t.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Today tab ────────────────────────────────────────────────────────────────
function TodayTab({ events, medications, acseScore, onOpen }: {
  events: Event[]; medications: Medication[]; acseScore: number; onOpen: (id: string) => void;
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

  // Animate score ring + counter on mount
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
      gsap.to(obj, {
        val: acseScore, duration: 1.3, ease: 'power2.out', delay: 0.35,
        onUpdate: () => { if (scoreNumRef.current) scoreNumRef.current.textContent = String(Math.round(obj.val)); },
      });
    }
  }, [acseScore]);

  // ScrollTrigger stagger for sections
  useEffect(() => {
    if (!containerRef.current) return;
    const sections = containerRef.current.querySelectorAll<HTMLElement>('.app-section, .app-card, .reco-section, .tips-section');
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

      {/* Watch activity rings */}
      <WatchStrip />

      {/* Cognitive score */}
      <section className="app-section">
        <h2 className="app-section-title">Cognitive Health</h2>
        <div className="app-card score-card" onClick={() => onOpen('memory')}>
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
            <p className="score-card__sublabel">
              {acseScore >= 80 ? 'Looking great today' : acseScore >= 60 ? 'Moderate — keep going' : 'Needs attention'}
            </p>
          </div>
          <Chevron />
        </div>
      </section>

      {/* Medications */}
      <section className="app-section">
        <h2 className="app-section-title">Medications</h2>
        <div className="app-card-group">
          {dueMeds.length === 0 ? (
            <div className="app-card-row app-card-row--single">
              <span className="row-icon row-icon--green"><svg viewBox="0 0 24 24" fill="none" width="18" height="18"><path d="M5 12l4 4 10-9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
              <span className="row-text">All medications up to date</span>
            </div>
          ) : dueMeds.slice(0, 3).map(med => (
            <div key={med.name} className="app-card-row" onClick={() => onOpen('meds')}>
              <span className="row-icon row-icon--orange">💊</span>
              <span className="row-text">{med.name}</span>
              <span className="row-badge row-badge--orange">Due now</span>
            </div>
          ))}
          <div className="app-card-row app-card-row--action" onClick={() => onOpen('meds')}>
            <span className="row-text">View all medications</span><Chevron />
          </div>
        </div>
      </section>

      {/* Upcoming events */}
      <section className="app-section">
        <h2 className="app-section-title">Coming Up</h2>
        <div className="app-card-group">
          {upcoming.length === 0 ? (
            <div className="app-card-row app-card-row--single">
              <span className="row-text" style={{ color: 'rgba(60,60,67,0.45)' }}>Nothing scheduled — enjoy your day</span>
            </div>
          ) : upcoming.map(ev => (
            <div key={ev.id} className="app-card-row">
              <span className="row-icon row-icon--blue">📅</span>
              <span className="row-text">{ev.title}</span>
              <span className="row-time">{new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Charts row */}
      <section className="app-section">
        <h2 className="app-section-title">Health Charts</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <StepsChart />
          <HeartRateChart />
          <SleepChart />
        </div>
      </section>

      {/* Walk map */}
      <section className="app-section">
        <h2 className="app-section-title">Last Walk</h2>
        <WalkMap />
      </section>

      {/* Quick actions */}
      <section className="app-section">
        <h2 className="app-section-title">Quick Actions</h2>
        <div className="quick-action-row">
          <button className="quick-action-btn quick-action-btn--blue tap-feedback" onClick={() => onOpen('voice')}>
            🗣️ Talk to Clara
          </button>
          <button className="quick-action-btn quick-action-btn--red tap-feedback" onClick={() => onOpen('safety')}>
            🚨 Safety
          </button>
        </div>
      </section>

      {/* Recommendations carousel */}
      <RecommendationsSection />

      {/* Health tips */}
      <HealthTips />

      <div style={{ height: 32 }} />
    </div>
  );
}

// ── Care tab ─────────────────────────────────────────────────────────────────
function CareTab({ onOpen }: { onOpen: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const items = ref.current.querySelectorAll<HTMLElement>('.app-section, .app-card-group');
    gsap.fromTo(items, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.45, stagger: 0.08, ease: 'power2.out' });
  }, []);
  return (
    <div ref={ref} className="tab-scroll">
      <section className="app-section">
        <h2 className="app-section-title">Medications</h2>
        <div className="app-card-group">
          <div className="app-card-nav-row" onClick={() => onOpen('meds')}>
            <span className="nav-row-icon" style={{ background: '#FFF3E5' }}>💊</span>
            <div className="nav-row-body">
              <span className="nav-row-label">Medication Tracker</span>
              <span className="nav-row-sub">Log & track all medications</span>
            </div>
            <Chevron />
          </div>
        </div>
      </section>
      <section className="app-section">
        <h2 className="app-section-title">People</h2>
        <div className="app-card-group">
          <div className="app-card-nav-row" onClick={() => onOpen('faces')}>
            <span className="nav-row-icon" style={{ background: '#E5F6FB' }}>👥</span>
            <div className="nav-row-body">
              <span className="nav-row-label">Familiar Faces</span>
              <span className="nav-row-sub">Friends and family</span>
            </div>
            <Chevron />
          </div>
          <div className="app-card-nav-row" onClick={() => onOpen('safety')}>
            <span className="nav-row-icon" style={{ background: '#FFEBEA' }}>🛡️</span>
            <div className="nav-row-body">
              <span className="nav-row-label">Safety Circle</span>
              <span className="nav-row-sub">Emergency contacts</span>
            </div>
            <Chevron />
          </div>
        </div>
      </section>
      <section className="app-section">
        <h2 className="app-section-title">Physical Health</h2>
        <div className="app-card-group">
          <div className="app-card-nav-row" style={{ pointerEvents: 'none', opacity: 0.7 }}>
            <span className="nav-row-icon" style={{ background: '#E8F5E9' }}>🩺</span>
            <div className="nav-row-body">
              <span className="nav-row-label">Vital Signs</span>
              <span className="nav-row-sub">Blood pressure, O₂ saturation</span>
            </div>
            <span style={{ fontSize: 11, color: '#007AFF', fontWeight: 600 }}>Soon</span>
          </div>
          <div className="app-card-nav-row" style={{ pointerEvents: 'none', opacity: 0.7 }}>
            <span className="nav-row-icon" style={{ background: '#FDE8F3' }}>📊</span>
            <div className="nav-row-body">
              <span className="nav-row-label">Lab Results</span>
              <span className="nav-row-sub">Blood work, glucose levels</span>
            </div>
            <span style={{ fontSize: 11, color: '#007AFF', fontWeight: 600 }}>Soon</span>
          </div>
        </div>
      </section>
      <div style={{ height: 24 }} />
    </div>
  );
}

// ── Mind tab ─────────────────────────────────────────────────────────────────
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
          <div className="clara-hero-card__cta">Talk now →</div>
        </div>
      </section>
      <section className="app-section">
        <h2 className="app-section-title">Activities</h2>
        <div className="app-card-group">
          <div className="app-card-nav-row" onClick={() => onOpen('games')}>
            <span className="nav-row-icon" style={{ background: '#F3EEFF' }}>🎮</span>
            <div className="nav-row-body">
              <span className="nav-row-label">Mind Games</span>
              <span className="nav-row-sub">Wordle, Sudoku & more</span>
            </div>
            <Chevron />
          </div>
          <div className="app-card-nav-row" onClick={() => onOpen('memory')}>
            <span className="nav-row-icon" style={{ background: '#FDE8F3' }}>🧠</span>
            <div className="nav-row-body">
              <span className="nav-row-label">Memory</span>
              <span className="nav-row-sub">Cognitive dashboard & recap</span>
            </div>
            <Chevron />
          </div>
        </div>
      </section>
      <section className="app-section">
        <h2 className="app-section-title">Brain Training</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="app-card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E' }}>Weekly Challenge Streak</span>
              <span style={{ fontSize: 20 }}>🔥</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {['M','T','W','T','F','S','S'].map((d, i) => (
                <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{
                    height: 28, borderRadius: 6, marginBottom: 4,
                    background: i < 5 ? '#007AFF' : 'rgba(60,60,67,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {i < 5 && <span style={{ fontSize: 12 }}>✓</span>}
                  </div>
                  <span style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)' }}>{d}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12, color: 'rgba(60,60,67,0.5)', marginTop: 8, marginBottom: 0 }}>
              5-day streak 🎉 Keep it up!
            </p>
          </div>
        </div>
      </section>
      <div style={{ height: 24 }} />
    </div>
  );
}

// ── Panel ────────────────────────────────────────────────────────────────────
function Panel({ id, panelRef, onClose, user }: {
  id: string; panelRef: React.RefObject<HTMLDivElement>; onClose: () => void; user: User | null;
}) {
  const { triggerMemoryRecap } = useAppStore();
  return (
    <div ref={panelRef} className="app-panel">
      <div className="app-panel-header">
        <button className="app-back-btn" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>
        <span className="app-panel-title">{PANEL_TITLES[id] ?? id}</span>
        <div style={{ width: 60 }} />
      </div>
      <div className="app-panel-content">
        {id === 'voice'  && <VoiceAgent />}
        {id === 'meds'   && <MedTracker />}
        {id === 'games'  && <GameHub />}
        {id === 'memory' && (
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

// ── Main ─────────────────────────────────────────────────────────────────────
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

  // Panel slide-in
  useEffect(() => {
    if (!panelRef.current || !panel) return;
    gsap.fromTo(panelRef.current,
      { x: '100%', opacity: 0.8 },
      { x: '0%', opacity: 1, duration: 0.36, ease: 'power3.out' }
    );
  }, [panel]);

  const handleTabChange = useCallback((t: PatientTab) => {
    if (t === tab) return;
    if (mainRef.current) {
      gsap.fromTo(mainRef.current,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }
      );
    }
    setTab(t);
    recordNavigation();
  }, [tab, recordNavigation]);

  const openPanel = (id: string) => { recordNavigation(); setPanel(id); };
  const closePanel = () => {
    if (panelRef.current) {
      gsap.to(panelRef.current, {
        x: '100%', opacity: 0.7, duration: 0.28, ease: 'power2.in',
        onComplete: () => setPanel(null),
      });
    } else setPanel(null);
  };

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
          <p className="app-header__eyebrow">
            {new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'}
          </p>
          <h1 className="app-header__name">{firstName}</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="app-header__score-pill" title="Cognitive score">
            <span className="app-header__score-dot" style={{
              background: acseScore >= 80 ? '#34C759' : acseScore >= 60 ? '#FF9500' : '#FF3B30'
            }} />
            {acseScore}
          </div>
          <button className="app-header__avatar tap-feedback" onClick={() => setScreen('login')} title="Switch user">
            {firstName.charAt(0).toUpperCase()}
          </button>
        </div>
      </header>

      <main ref={mainRef} className="app-main">
        {tab === 'today'   && <TodayTab events={events} medications={medications} acseScore={acseScore} onOpen={openPanel} />}
        {tab === 'care'    && <CareTab onOpen={openPanel} />}
        {tab === 'mind'    && <MindTab onOpen={openPanel} />}
        {tab === 'routine' && <div className="tab-scroll"><RoutineChecklist /></div>}
      </main>

      <nav className="app-tab-bar">
        {([
          { id: 'today',   label: 'Today',   icon: <IcoToday /> },
          { id: 'care',    label: 'Care',    icon: <IcoCare /> },
          { id: 'mind',    label: 'Mind',    icon: <IcoMind /> },
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
      {demoMode && (
        <GoldenPathDemo onNavigate={openPanel} onClose={() => setDemoMode(false)} />
      )}
    </div>
  );
}
