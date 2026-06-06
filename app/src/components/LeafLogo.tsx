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
