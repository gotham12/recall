export type IconName =
  | 'home'
  | 'clara'
  | 'meds'
  | 'events'
  | 'score'
  | 'profile'
  | 'alert'
  | 'close'
  | 'check'
  | 'circle'
  | 'calendar'
  | 'user'
  | 'warning'
  | 'success'
  | 'send'
  | 'mic'
  | 'speaker'
  | 'thinking'
  | 'chat'
  | 'logout'
  | 'add'
  | 'stable'
  | 'moderate'
  | 'low'
  | 'flower'
  | 'refresh'
  | 'sun'
  | 'moon'
  | 'heart'
  | 'shield'
  | 'sos'
  | 'location'
  | 'routine'
  | 'music'
  | 'export'
  | 'settings'
  | 'brain'
  | 'puzzle';

interface StudioIconProps {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

const PATHS: Record<IconName, JSX.Element> = {
  home: (
    <>
      <circle cx="12" cy="12" r="9" strokeOpacity="0.5" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
    </>
  ),
  clara: (
    <>
      <path d="M8 14c1.5 1.2 3.2 1.8 4 1.8s2.5-.6 4-1.8" />
      <path d="M12 6a3 3 0 100 6 3 3 0 000-6z" />
      <path d="M6 20v-1.2a6 6 0 0112 0V20" />
    </>
  ),
  meds: (
    <>
      <rect x="6" y="4" width="12" height="16" rx="3" />
      <line x1="9" y1="9" x2="15" y2="9" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="15" x2="13" y2="15" />
    </>
  ),
  events: (
    <>
      <path d="M7 5h10v14H7z" />
      <path d="M9 3v4M15 3v4M7 10h10" />
    </>
  ),
  score: (
    <>
      <path d="M5 18V8M9 18V5M13 18v-7M17 18v-4" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M6 20v-1.5a6 6 0 0112 0V20" />
    </>
  ),
  alert: (
    <>
      <path d="M12 5l7 12H5l7-12z" />
      <path d="M12 10v3M12 16h.01" />
    </>
  ),
  close: (
    <>
      <path d="M8 8l8 8M16 8l-8 8" />
    </>
  ),
  check: (
    <path d="M6 12l3.5 3.5L18 8" />
  ),
  circle: (
    <circle cx="12" cy="12" r="7" />
  ),
  calendar: (
    <>
      <rect x="5" y="6" width="14" height="13" rx="2" />
      <path d="M8 4v4M16 4v4M5 11h14" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="9" r="3" />
      <path d="M7 20v-1a5 5 0 0110 0v1" />
    </>
  ),
  warning: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v5M12 16h.01" />
    </>
  ),
  success: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M8.5 12l2.5 2.5 4.5-5" />
    </>
  ),
  send: (
    <path d="M5 12l12-7-3 14-4-5-5-2z" />
  ),
  mic: (
    <>
      <rect x="9" y="4" width="6" height="10" rx="3" />
      <path d="M6 11a6 6 0 0012 0M12 17v3" />
    </>
  ),
  speaker: (
    <>
      <path d="M9 9H6v6h3l5 4V5L9 9z" />
      <path d="M17 9a3 3 0 010 6M18 7a5 5 0 010 10" />
    </>
  ),
  thinking: (
    <>
      <circle cx="7" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="17" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  chat: (
    <>
      <path d="M5 6h14a2 2 0 012 2v7a2 2 0 01-2 2H10l-4 4v-4H5a2 2 0 01-2-2V8a2 2 0 012-2z" />
    </>
  ),
  logout: (
    <>
      <path d="M10 6H6a2 2 0 00-2 2v8a2 2 0 002 2h4" />
      <path d="M14 12h8M18 8l4 4-4 4" />
    </>
  ),
  add: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  stable: (
    <>
      <path d="M6 14c2 2 4 3 6 3s4-1 6-3" />
      <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  moderate: (
    <>
      <path d="M8 15h8" />
      <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  low: (
    <>
      <path d="M8 16c1.5-2 3-3 4-3s2.5 1 4 3" />
      <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  flower: (
    <>
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 4v3M12 17v3M4 12h3M17 12h3M6.3 6.3l2.1 2.1M15.6 15.6l2.1 2.1M17.7 6.3l-2.1 2.1M8.4 15.6l-2.1 2.1" />
    </>
  ),
  refresh: (
    <>
      <path d="M4 12a8 8 0 0113.5-5.7" />
      <path d="M20 12a8 8 0 01-13.5 5.7" />
      <path d="M16 4.5V8h-3.5M8 19.5V16h3.5" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
    </>
  ),
  moon: (
    <>
      <path d="M20 14.5A7.5 7.5 0 019.5 4 6.5 6.5 0 1014 20a7.5 7.5 0 006-5.5z" />
    </>
  ),
  heart: (
    <path d="M12 20.5l-1.2-1.1C6.5 15.4 4 13.1 4 10a4 4 0 017.2-2.2A4 4 0 0112 8.5a4 4 0 014.8-0.7A4 4 0 0120 10c0 3.1-2.5 5.4-6.8 9.4L12 20.5z" />
  ),
  shield: (
    <>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  sos: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v1M12 11v5" strokeWidth={2} />
    </>
  ),
  location: (
    <>
      <path d="M12 21s6-5.2 6-10a6 6 0 10-12 0c0 4.8 6 10 6 10z" />
      <circle cx="12" cy="11" r="2" />
    </>
  ),
  routine: (
    <>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" strokeWidth={3} />
    </>
  ),
  music: (
    <>
      <circle cx="8" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
      <path d="M11 18V6l10-2v12" />
    </>
  ),
  export: (
    <>
      <path d="M12 4v10M8 10l4 4 4-4" />
      <path d="M5 18h14" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  brain: (
    <>
      <path d="M8 5c-2 1-3 3-3 5a3 3 0 003 3c0 2 1 3 2 4M16 5c2 1 3 3 3 5a3 3 0 01-3 3c0 2-1 3-2 4" />
      <path d="M9 8c0-1 1-2 3-2s3 1 3 2M12 11v5M10 14h4" />
    </>
  ),
  puzzle: (
    <>
      <path d="M8 4h3v3H8zM13 4h3v3h-3zM4 8h3v3H4zM17 8h3v3h-3zM8 13h3v3H8zM13 17h3v3h-3z" />
      <path d="M11 8h2v2h-2zM8 11h2v2H8zM14 11h2v2h-2zM11 14h2v2h-2z" />
    </>
  ),
};

export default function StudioIcon({
  name,
  size = 22,
  className = '',
  strokeWidth = 1.6,
}: StudioIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`studio-icon ${className}`}
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}
