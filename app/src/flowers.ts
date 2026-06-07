import type { ThemeMode } from './lib/theme';

const base = import.meta.env.BASE_URL;

const FLOWER_FILES = {
  splash: 'flower-01-splash.webp',
  landing: 'flower-02-landing.webp',
  patient: 'flower-03-patient.webp',
  supervisor: 'flower-04-supervisor.webp',
  patientEnter: 'flower-05-patient-enter.webp',
  supervisorEnter: 'flower-06-supervisor-enter.webp',
  patientApp: 'flower-07-patient-app.webp',
  supervisorApp: 'flower-08-supervisor-app.webp',
  home: 'flower-09-home.webp',
  comfort: 'flower-10-comfort.webp',
} as const;

export type FlowerKey = keyof typeof FLOWER_FILES;

function flowerPath(file: string, theme: ThemeMode): string {
  const folder = theme === 'light' ? 'flowers/light' : 'flowers';
  return `${base}${folder}/${file}`;
}

export function getFlowers(theme: ThemeMode = 'light'): Record<FlowerKey, string> {
  return Object.fromEntries(
    Object.entries(FLOWER_FILES).map(([key, file]) => [key, flowerPath(file, theme)])
  ) as Record<FlowerKey, string>;
}

/** @deprecated Use getFlowers(theme) for theme-aware paths */
export const FLOWERS = getFlowers('dark');
