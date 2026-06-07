import { API_BASE_URL } from '../env';

let warnedDirectKeys = false;

export function usesApiProxy(): boolean {
  return Boolean(API_BASE_URL?.trim());
}

export function warnDirectApiKeys(): void {
  if (!warnedDirectKeys && !usesApiProxy() && import.meta.env.PROD) {
    warnedDirectKeys = true;
    console.warn(
      '[Recall] API keys are exposed in the client bundle. Deploy proxy/worker.mjs and set VITE_API_BASE_URL.'
    );
  }
}

export async function proxyPost<T>(path: string, body: unknown): Promise<T> {
  if (!API_BASE_URL) throw new Error('API proxy not configured');
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Proxy ${path} failed (${res.status})${detail ? `: ${detail.slice(0, 120)}` : ''}`);
  }
  return res.json() as Promise<T>;
}

export async function proxyPostBlob(path: string, body: unknown): Promise<Blob> {
  if (!API_BASE_URL) throw new Error('API proxy not configured');
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Proxy ${path} failed (${res.status})`);
  return res.blob();
}
