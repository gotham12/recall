import { useEffect } from 'react';

// ─── Brand mark (exported — used across the app) ─────────────────────────────
export function LeafLogo({ size = 32, color = '#16A34A' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M24 4 C36 4, 44 14, 44 26 C44 36, 36 44, 24 44 C16 44, 10 38, 10 30 C10 18, 16 6, 24 4Z"
        fill={color} opacity="0.15"
      />
      <path
        d="M24 4 C36 4, 44 14, 44 26 C44 36, 36 44, 24 44 C16 44, 10 38, 10 30 C10 18, 16 6, 24 4Z"
        fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      />
      <path d="M24 8 Q22 26 20 44" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <path d="M22 16 Q30 18 38 16" stroke={color} strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.6"/>
      <path d="M21 24 Q30 26 40 22" stroke={color} strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.6"/>
      <path d="M21 32 Q28 34 36 30" stroke={color} strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.6"/>
      <path d="M20 44 Q18 47 14 47" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none"/>
      <circle cx="38" cy="14" r="2.5" fill={color} opacity="0.5"/>
      <circle cx="36.5" cy="12.5" r="0.8" fill="white" opacity="0.8"/>
    </svg>
  );
}

// ─── Loading screen ──────────────────────────────────────────────────────────
export default function LoadingScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3400);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#F1F8F2',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>

      {/* ── Ambient radial glow from center ── */}
      <div style={{
        position: 'absolute',
        width: 480, height: 480,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(22,163,74,0.10) 0%, transparent 70%)',
        animation: 'glowIn 1.2s cubic-bezier(0.2,0,0,1) 0s both',
        pointerEvents: 'none',
      }} />

      {/* ── Static decorative leaves in corners ── */}
      <div style={{ position: 'absolute', bottom: -24, left: -24, opacity: 0.055, transform: 'rotate(-18deg)', pointerEvents: 'none' }}>
        <LeafLogo size={240} color="#16A34A" />
      </div>
      <div style={{ position: 'absolute', top: -32, right: -24, opacity: 0.055, transform: 'rotate(145deg)', pointerEvents: 'none' }}>
        <LeafLogo size={190} color="#16A34A" />
      </div>

      {/* ── Hero zone ── */}
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 10 }}>

        {/* Tonal expansion rings — M3 "dynamic color reveal" */}
        {[148, 112].map((sz, i) => (
          <div key={i} style={{
            position: 'absolute',
            width: sz, height: sz,
            borderRadius: 32 + (i * 8),
            border: `1.5px solid rgba(22,163,74,${0.22 - i * 0.07})`,
            top: '50%', left: '50%',
            transform: 'translate(-50%,-50%) scale(0.7)',
            animation: `ringReveal 0.6s cubic-bezier(0.2,0,0,1) ${0.25 + i * 0.1}s both`,
            pointerEvents: 'none',
          }} />
        ))}

        {/* App icon — Material You squircle container */}
        <div style={{
          width: 104, height: 104,
          borderRadius: 30,
          background: 'linear-gradient(145deg, #E6F7EC, #D0F0DB)',
          boxShadow: '0 2px 8px rgba(22,163,74,0.10), 0 8px 24px rgba(22,163,74,0.14), inset 0 1px 0 rgba(255,255,255,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'iconIn 0.55s cubic-bezier(0.34,1.36,0.64,1) 0.15s both',
          position: 'relative',
        }}>
          <LeafLogo size={60} color="#16A34A" />

          {/* Inner gloss */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '52%',
            borderRadius: '30px 30px 50% 50%',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.45) 0%, transparent 100%)',
            pointerEvents: 'none',
          }} />
        </div>

        {/* App name */}
        <h1 style={{
          fontFamily: 'Inter, sans-serif',
          fontWeight: 700,
          fontSize: 38,
          color: '#1A3A22',
          margin: '28px 0 0',
          letterSpacing: '-0.6px',
          lineHeight: 1,
          animation: 'textUp 0.5s cubic-bezier(0.2,0,0,1) 0.55s both',
        }}>
          Recall
        </h1>

        {/* Subtitle chip — Stitch-style tonal chip */}
        <div style={{
          marginTop: 14,
          padding: '5px 14px',
          borderRadius: 999,
          background: 'rgba(22,163,74,0.09)',
          border: '1px solid rgba(22,163,74,0.18)',
          animation: 'textUp 0.5s cubic-bezier(0.2,0,0,1) 0.72s both',
        }}>
          <span style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 600,
            fontSize: 11,
            color: '#2D6A41',
            letterSpacing: '0.10em',
            textTransform: 'uppercase' as const,
          }}>
            Cognitive Care Platform
          </span>
        </div>

      </div>

      {/* ── M3 indeterminate linear progress — bottom edge ── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: 3,
        background: '#C8EDD4',
        overflow: 'hidden',
        animation: 'progressAppear 0.4s ease 0.4s both',
        opacity: 0,
      }}>
        <div style={{
          position: 'absolute', height: '100%',
          background: 'linear-gradient(90deg, transparent, #16A34A, #22C55E, #16A34A, transparent)',
          animation: 'm3sweep 1.6s cubic-bezier(0.4,0,0.2,1) 0.4s infinite',
          width: '50%',
        }} />
      </div>

      <style>{`
        @keyframes glowIn {
          from { opacity: 0; transform: scale(0.4); }
          to   { opacity: 1; transform: scale(1); }
        }

        @keyframes ringReveal {
          from { opacity: 0; transform: translate(-50%,-50%) scale(0.7); }
          to   { opacity: 1; transform: translate(-50%,-50%) scale(1); }
        }

        @keyframes iconIn {
          from { opacity: 0; transform: scale(0.72) translateY(10px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }

        @keyframes textUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @keyframes progressAppear {
          to { opacity: 1; }
        }

        @keyframes m3sweep {
          0%   { left: -60%;  }
          100% { left: 110%; }
        }
      `}</style>
    </div>
  );
}
