export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '');
export const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY as string;
export const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY as string;
export const GOOGLE_VISION_KEY = import.meta.env.VITE_GOOGLE_VISION_KEY as string;
export const SUPERVISOR_PASSWORD =
  (import.meta.env.VITE_SUPERVISOR_PASSWORD as string | undefined)?.trim() || 'care2026';
