import { SUPERVISOR_PASSWORD } from '../env';

const STORAGE_KEY = 'recall_supervisor_auth';
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

interface AuthState {
  attempts: number;
  lockedUntil: number;
}

function readState(): AuthState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { attempts: 0, lockedUntil: 0 };
    return JSON.parse(raw) as AuthState;
  } catch {
    return { attempts: 0, lockedUntil: 0 };
  }
}

function writeState(state: AuthState) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function checkSupervisorAuth(password: string): { ok: boolean; error?: string } {
  const state = readState();
  const now = Date.now();

  if (now < state.lockedUntil) {
    const mins = Math.ceil((state.lockedUntil - now) / 60000);
    return { ok: false, error: `Too many attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.` };
  }

  const expected = SUPERVISOR_PASSWORD?.trim();
  if (!expected) {
    return { ok: false, error: 'Supervisor access is not configured.' };
  }

  if (password === expected) {
    sessionStorage.removeItem(STORAGE_KEY);
    return { ok: true };
  }

  const attempts = state.attempts + 1;
  if (attempts >= MAX_ATTEMPTS) {
    writeState({ attempts: 0, lockedUntil: now + LOCKOUT_MS });
    return { ok: false, error: 'Too many attempts. Try again in 15 minutes.' };
  }

  writeState({ attempts, lockedUntil: 0 });
  return { ok: false, error: 'Incorrect password.' };
}
