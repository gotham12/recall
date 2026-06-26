/**
 * Cross-tab sync — patient phone tab ↔ caregiver laptop tab.
 * Uses BroadcastChannel + localStorage (same origin).
 */

const CHANNEL = 'recall-sync';

/** Ignore sync messages published by this tab (prevents self-echo side effects). */
const LOCAL_TAB_ID =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `tab-${Date.now()}-${Math.random()}`;

const handledAt = new Map<string, number>();

export type SyncMessage =
  | { type: 'acse'; score: number; reason?: string; at: number; tabId?: string }
  | { type: 'comfort'; active: boolean; at: number; tabId?: string }
  | { type: 'alert'; message: string; alertType: string; at: number; tabId?: string }
  | { type: 'presence'; caregiverName: string; at: number; tabId?: string }
  | { type: 'warmth_ack'; at: number; tabId?: string };

function roomKey(userId: number): string {
  return `recall-sync-room-${userId}`;
}

function readRoom(userId: number): SyncMessage[] {
  try {
    const raw = localStorage.getItem(roomKey(userId));
    if (!raw) return [];
    return JSON.parse(raw) as SyncMessage[];
  } catch {
    return [];
  }
}

function writeRoom(userId: number, messages: SyncMessage[]): void {
  try {
    localStorage.setItem(roomKey(userId), JSON.stringify(messages.slice(-40)));
  } catch {
    /* ignore */
  }
}

export function publishSync(userId: number, message: SyncMessage): void {
  const stamped = { ...message, at: message.at || Date.now(), tabId: LOCAL_TAB_ID } as SyncMessage;
  const room = readRoom(userId);
  room.push(stamped);
  writeRoom(userId, room);

  try {
    const ch = new BroadcastChannel(CHANNEL);
    ch.postMessage({ userId, message: stamped });
    ch.close();
  } catch {
    /* ignore */
  }
}

export function subscribeSync(
  userId: number,
  onMessage: (message: SyncMessage) => void
): () => void {
  const handle = (msg: SyncMessage) => {
    if (msg.tabId === LOCAL_TAB_ID) return;
    if (Date.now() - msg.at >= 120_000) return;
    const dedupeKey = `${msg.type}:${msg.at}`;
    if ((handledAt.get(dedupeKey) ?? 0) >= msg.at) return;
    handledAt.set(dedupeKey, msg.at);
    onMessage(msg);
  };

  const existing = readRoom(userId);
  existing.slice(Math.max(0, existing.length - 5)).forEach(handle);

  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (e: MessageEvent<{ userId: number; message: SyncMessage }>) => {
      if (e.data?.userId === userId) handle(e.data.message);
    };
  } catch {
    /* ignore */
  }

  const onStorage = (e: StorageEvent) => {
    if (e.key !== roomKey(userId) && e.key !== null) return;
    const room = readRoom(userId);
    const latest = room[room.length - 1];
    if (latest) handle(latest);
  };
  window.addEventListener('storage', onStorage);

  const poll = window.setInterval(() => {
    const room = readRoom(userId);
    const latest = room[room.length - 1];
    if (latest) handle(latest);
  }, 2000);

  return () => {
    window.removeEventListener('storage', onStorage);
    window.clearInterval(poll);
    channel?.close();
  };
}
