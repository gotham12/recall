import { db } from '../db/db';

function truncate(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** Persist Clara voice exchanges so supervisor briefing can reference them. */
export async function logClaraVoiceExchange(
  userId: number,
  userUtterance: string,
  claraReply: string,
  intent: string
): Promise<void> {
  try {
    await db.events.add({
      userId,
      timestamp: new Date().toISOString(),
      type: 'user_action',
      title: `Clara: "${truncate(userUtterance, 72)}"`,
      description: `[${intent}] ${truncate(claraReply, 240)}`,
      completed: true,
      source: 'voice',
    });
  } catch (err) {
    console.warn('[Clara activity log]', err);
  }
}
