interface ForgetMeNotMarkProps {
  size?: number;
  className?: string;
}

/** Forget-me-not flower — 5 blue petals, golden center */
export default function ForgetMeNotMark({ size = 32, className = '' }: ForgetMeNotMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`forget-me-not-mark ${className}`}
      aria-hidden
    >
      <circle cx="16" cy="7.5" r="4.2" fill="url(#petalTop)" />
      <circle cx="23" cy="12.5" r="4.2" fill="url(#petalRight)" />
      <circle cx="20.5" cy="21" r="4.2" fill="url(#petalBR)" />
      <circle cx="11.5" cy="21" r="4.2" fill="url(#petalBL)" />
      <circle cx="9" cy="12.5" r="4.2" fill="url(#petalLeft)" />
      <circle cx="16" cy="14.5" r="3.8" fill="url(#center)" />
      <circle cx="16" cy="14.5" r="1.6" fill="#FFF8DC" opacity="0.9" />
      <path d="M16 18.5v6" stroke="#3D8B6E" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M14 24.5c1 1.5 3 1.5 4 0" stroke="#3D8B6E" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <defs>
        <radialGradient id="petalTop" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#8ECDF5" />
          <stop offset="100%" stopColor="#3B82C4" />
        </radialGradient>
        <radialGradient id="petalRight" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#7EC0F0" />
          <stop offset="100%" stopColor="#2E6DB0" />
        </radialGradient>
        <radialGradient id="petalBR" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#8ECDF5" />
          <stop offset="100%" stopColor="#3578B8" />
        </radialGradient>
        <radialGradient id="petalBL" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#7EC0F0" />
          <stop offset="100%" stopColor="#2E6DB0" />
        </radialGradient>
        <radialGradient id="petalLeft" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#8ECDF5" />
          <stop offset="100%" stopColor="#3B82C4" />
        </radialGradient>
        <radialGradient id="center" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFE566" />
          <stop offset="100%" stopColor="#F5A623" />
        </radialGradient>
      </defs>
    </svg>
  );
}
