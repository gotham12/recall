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
  | 'flower';

interface StudioIconProps {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

const PATHS: Record<IconName, JSX.Element> = {
  home: (
    <>
      <path d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1v-9.5z" />
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
      <rect x="7" y="7" width="10" height="10" rx="5" />
      <path d="M12 9v6M9 12h6" />
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
