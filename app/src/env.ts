/** Cloudflare Worker proxy — keys stay server-side; browser calls this URL only. */
export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ||
  'https://recall-api.avijayasankaran.workers.dev';
export const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY as string;
export const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string;
export const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY as string;
export const GOOGLE_VISION_KEY = import.meta.env.VITE_GOOGLE_VISION_KEY as string;
export const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY as string;
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY as string;
export const SUPERVISOR_PASSWORD =
  (import.meta.env.VITE_SUPERVISOR_PASSWORD as string | undefined)?.trim() || 'care';
