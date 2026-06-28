import { db, type User } from '../db/db';
import { useAppStore } from '../store/appStore';
import { readPersistedComfortActive } from './syncBridge';

import { stopSpeaking } from '../services/elevenlabs';

export async function loadUserSession(user: User): Promise<void> {
  if (!user.id) return;

  const scores = await db.acseScores.where('userId').equals(user.id).toArray();
  const latestScore = scores.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )[0];

  const alerts = await db.supervisorAlerts
    .where('userId')
    .equals(user.id)
    .and((a) => !a.dismissed)
    .toArray();

  const sortedAlerts = alerts.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  useAppStore.setState({
    user,
    acseScore: latestScore?.score ?? 100,
    comfortModeActive: readPersistedComfortActive(user.id),
    supervisorAlerts: sortedAlerts.map((a) => ({
      id: String(a.id ?? `${a.timestamp}-${a.message}`),
      message: a.message,
      timestamp: a.timestamp,
      type: a.type === 'presence' ? 'general' : a.type,
    })),
  });
}

export function logout(): void {
  stopSpeaking();
  useAppStore.getState().resetSession();
}
