import { db, type User } from '../db/db';
import { buildClaraRichContext } from './claraContext';
import { useAppStore } from '../store/appStore';
import { loadCareSettings } from './careSettings';

const STORAGE_PREFIX = 'recall-supervisor-last-checkin';

export interface SupervisorBriefingSnapshot {
  patientName: string;
  caregiverName: string;
  acseScore: number;
  previousAcseScore: number | null;
  comfortModeActive: boolean;
  comfortThreshold: number;
  lastCheckInAt: string | null;
  lastCheckInLabel: string;
  medsTakenToday: string[];
  medsPending: string[];
  medsUnconfirmed: string[];
  dueMedsNow: string[];
  upcomingToday: string[];
  nextCheckup: string | null;
  completedToday: string[];
  eventsSinceCheckIn: { title: string; time: string; completed: boolean; isFuture: boolean }[];
  claraConversations: string[];
  alertsSinceCheckIn: string[];
  liveAlerts: string[];
  routinesCompleted: string[];
  routinesPending: string[];
  recentAcseChanges: { score: number; reason: string; time: string }[];
  acseSignalsSinceCheckIn: string[];
  lastSleep: string | null;
  careJournalNotes: string[];
}

function checkInKey(userId: number): string {
  return `${STORAGE_PREFIX}-${userId}`;
}

export function getLastSupervisorCheckIn(userId: number): string | null {
  try {
    return localStorage.getItem(checkInKey(userId));
  } catch {
    return null;
  }
}

export function markSupervisorCheckIn(userId: number): void {
  try {
    localStorage.setItem(checkInKey(userId), new Date().toISOString());
  } catch {
    /* ignore */
  }
}

function formatCheckInLabel(iso: string | null): string {
  if (!iso) return 'your first visit today';
  const then = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 2) return 'a moment ago';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  return then.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function medNameMatches(logName: string, medName: string): boolean {
  return logName.toLowerCase().includes(medName.toLowerCase())
    || medName.toLowerCase().includes(logName.toLowerCase());
}

/** Aggregate patient + Clara data for the supervisor AI briefing. */
export async function gatherSupervisorBriefingSnapshot(
  user: User,
  acseScore: number,
  comfortModeActive: boolean
): Promise<SupervisorBriefingSnapshot> {
  const userId = user.id!;
  const lastCheckInAt = getLastSupervisorCheckIn(userId);
  const since = lastCheckInAt ? new Date(lastCheckInAt) : todayStart();
  const sinceMs = since.getTime();
  const now = new Date();
  const settings = loadCareSettings(userId);

  const ctx = await buildClaraRichContext(user, acseScore);
  const store = useAppStore.getState();

  const [events, medLogs, acseHistory, alerts, journal] = await Promise.all([
    db.events.where('userId').equals(userId).toArray(),
    db.medicationLogs.where('userId').equals(userId).toArray(),
    db.acseScores.where('userId').equals(userId).reverse().limit(12).toArray(),
    db.supervisorAlerts.where('userId').equals(userId).toArray(),
    db.careJournal.where('userId').equals(userId).reverse().limit(3).toArray(),
  ]);

  const startMs = todayStart().getTime();

  const eventsSinceCheckIn = events
    .filter((e) => new Date(e.timestamp).getTime() >= sinceMs)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 15)
    .map((e) => {
      const ts = new Date(e.timestamp);
      return {
        title: e.title,
        time: ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        completed: e.completed,
        isFuture: !e.completed && ts > now,
      };
    });

  const claraConversations = events
    .filter((e) => e.source === 'voice' && new Date(e.timestamp).getTime() >= sinceMs)
    .map((e) => `${e.title}${e.description ? ` — ${e.description}` : ''}`)
    .slice(0, 8);

  const dbAlerts = alerts
    .filter((a) => new Date(a.timestamp).getTime() >= sinceMs && !a.dismissed)
    .map((a) => a.message);

  const liveAlerts = store.supervisorAlerts.map((a) => a.message);
  const alertsSinceCheckIn = [...new Set([...liveAlerts, ...dbAlerts])].slice(0, 6);

  const todayConfirmedLogs = medLogs.filter(
    (l) => new Date(l.timestamp).getTime() >= startMs && l.confirmed !== false
  );
  const todayUnconfirmed = medLogs.filter(
    (l) => new Date(l.timestamp).getTime() >= startMs && l.confirmed === false
  );

  const medsTakenToday = ctx.medications
    .filter((m) => todayConfirmedLogs.some((l) => medNameMatches(l.medicationName, m.name)))
    .map((m) => `${m.name} (${m.dosage})`);

  const medsPending = ctx.medications
    .filter((m) => !todayConfirmedLogs.some((l) => medNameMatches(l.medicationName, m.name)))
    .map((m) => `${m.name} (${m.dosage})`);

  const medsUnconfirmed = todayUnconfirmed.map(
    (l) => `${l.medicationName} (unverified at ${new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
  );

  const upcomingPlanned = events
    .filter((e) => e.type === 'planned' && !e.completed && new Date(e.timestamp) > now)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const checkupEvent = upcomingPlanned.find((e) => {
    const blob = `${e.title} ${e.description}`.toLowerCase();
    return blob.includes('checkup') || blob.includes('dr. chen') || blob.includes('doctor');
  }) ?? upcomingPlanned[0];

  const nextCheckup = checkupEvent
    ? `${checkupEvent.title} — ${new Date(checkupEvent.timestamp).toLocaleString([], {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}`
    : null;

  const upcomingToday = ctx.upcomingToday.length
    ? ctx.upcomingToday
    : upcomingPlanned.slice(0, 4).map((e) =>
        `${e.title} at ${new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      );

  const completedToday = ctx.completedToday.slice(0, 6);

  const recentAcseChanges = acseHistory
    .filter((s) => new Date(s.timestamp).getTime() >= sinceMs)
    .map((s) => ({
      score: s.score,
      reason: s.reason ?? 'Score update',
      time: new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }));

  const previousAcseScore =
    acseHistory.find((s) => new Date(s.timestamp).getTime() < sinceMs)?.score ??
    acseHistory[acseHistory.length - 1]?.score ??
    null;

  const acseSignalsSinceCheckIn = store.acseSignalLog
    .filter((s) => new Date(s.timestamp).getTime() >= sinceMs)
    .slice(0, 6)
    .map((s) => {
      const time = new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `${time}: ${s.reason} (${s.points > 0 ? '+' : ''}${s.points}, score ${s.scoreAfter})`;
    });

  const careJournalNotes = journal
    .filter((j) => new Date(j.timestamp).getTime() >= sinceMs)
    .map((j) => `${j.mood}: ${j.note}`)
    .slice(0, 3);

  return {
    patientName: user.name,
    caregiverName: user.caregiverName,
    acseScore,
    previousAcseScore,
    comfortModeActive,
    comfortThreshold: settings.comfortThreshold,
    lastCheckInAt,
    lastCheckInLabel: formatCheckInLabel(lastCheckInAt),
    medsTakenToday,
    medsPending,
    medsUnconfirmed,
    dueMedsNow: ctx.dueMedsNow,
    upcomingToday,
    nextCheckup,
    completedToday,
    eventsSinceCheckIn,
    claraConversations,
    alertsSinceCheckIn,
    liveAlerts,
    routinesCompleted: ctx.completedRoutines,
    routinesPending: ctx.pendingRoutines,
    recentAcseChanges,
    acseSignalsSinceCheckIn,
    lastSleep: ctx.lastSleep ?? null,
    careJournalNotes,
  };
}

export function formatBriefingContext(snapshot: SupervisorBriefingSnapshot): string {
  const lines: string[] = [
    `Patient: ${snapshot.patientName}`,
    `Caregiver: ${snapshot.caregiverName}`,
    `Last supervisor check-in: ${snapshot.lastCheckInLabel}`,
    `ACSE score now: ${snapshot.acseScore}${snapshot.previousAcseScore != null ? ` (was ${snapshot.previousAcseScore} at last check-in)` : ''}`,
    `ACSE comfort threshold: ${snapshot.comfortThreshold}`,
    `Comfort Mode active: ${snapshot.comfortModeActive ? 'yes' : 'no'}`,
    `Medications confirmed taken today: ${snapshot.medsTakenToday.join(', ') || 'none logged yet'}`,
    `Medications still pending today: ${snapshot.medsPending.join(', ') || 'none'}`,
    `Medications due now: ${snapshot.dueMedsNow.join(', ') || 'none'}`,
    `Unverified medication attempts: ${snapshot.medsUnconfirmed.join(', ') || 'none'}`,
    `Next checkup / appointment: ${snapshot.nextCheckup ?? 'none scheduled'}`,
    `Coming up today: ${snapshot.upcomingToday.join('; ') || 'nothing scheduled'}`,
    `Completed today: ${snapshot.completedToday.join('; ') || 'none logged'}`,
    `Routines completed: ${snapshot.routinesCompleted.join(', ') || 'none'}`,
    `Routines pending: ${snapshot.routinesPending.join(', ') || 'none'}`,
    `Sleep last night: ${snapshot.lastSleep ?? 'not logged'}`,
  ];

  if (snapshot.eventsSinceCheckIn.length) {
    lines.push('Events since last check-in:');
    for (const e of snapshot.eventsSinceCheckIn) {
      const tag = e.isFuture ? 'upcoming' : e.completed ? 'done' : 'incomplete';
      lines.push(`- [${e.time}] ${e.title} (${tag})`);
    }
  }

  if (snapshot.claraConversations.length) {
    lines.push('Clara voice conversations since last check-in:');
    for (const c of snapshot.claraConversations) lines.push(`- ${c}`);
  } else {
    lines.push('Clara voice conversations since last check-in: none recorded');
  }

  if (snapshot.acseSignalsSinceCheckIn.length) {
    lines.push('ACSE signals since last check-in:');
    for (const s of snapshot.acseSignalsSinceCheckIn) lines.push(`- ${s}`);
  }

  if (snapshot.recentAcseChanges.length) {
    lines.push('ACSE score history since last check-in:');
    for (const c of snapshot.recentAcseChanges) {
      lines.push(`- ${c.time}: ${c.score} — ${c.reason}`);
    }
  }

  if (snapshot.alertsSinceCheckIn.length) {
    lines.push('Alerts:');
    for (const a of snapshot.alertsSinceCheckIn) lines.push(`- ${a}`);
  }

  if (snapshot.careJournalNotes.length) {
    lines.push('Care journal since last check-in:');
    for (const n of snapshot.careJournalNotes) lines.push(`- ${n}`);
  }

  return lines.join('\n');
}

export function localSupervisorBriefing(snapshot: SupervisorBriefingSnapshot): string {
  const first = snapshot.patientName.split(' ')[0];
  const parts: string[] = [];

  parts.push(`Welcome back. Here's how ${first} has been since you last checked in ${snapshot.lastCheckInLabel}.`);

  if (snapshot.comfortModeActive) {
    parts.push(`${first} is currently in Comfort Mode and may need a gentle check-in when ready.`);
  } else if (snapshot.acseScore >= 75) {
    parts.push(`Cognitive stability looks solid (ACSE ${snapshot.acseScore}).`);
  } else if (snapshot.acseScore >= snapshot.comfortThreshold) {
    parts.push(`ACSE is ${snapshot.acseScore} — stable but worth monitoring.`);
  } else {
    parts.push(`ACSE is ${snapshot.acseScore}, below the comfort threshold of ${snapshot.comfortThreshold} — extra support is recommended.`);
  }

  if (snapshot.previousAcseScore != null) {
    const delta = snapshot.acseScore - snapshot.previousAcseScore;
    if (delta !== 0) {
      parts.push(
        delta < 0
          ? `That's ${Math.abs(delta)} points lower than at your last visit.`
          : `That's ${delta} points higher than at your last visit.`
      );
    }
  }

  if (snapshot.medsTakenToday.length) {
    parts.push(`Confirmed medications today: ${snapshot.medsTakenToday.join(', ')}.`);
  }
  if (snapshot.medsUnconfirmed.length) {
    parts.push(`Unverified med attempts: ${snapshot.medsUnconfirmed.join(', ')}.`);
  }
  if (snapshot.dueMedsNow.length) {
    parts.push(`Due now: ${snapshot.dueMedsNow.join(', ')}.`);
  } else if (snapshot.medsPending.length) {
    parts.push(`Still pending today: ${snapshot.medsPending.join(', ')}.`);
  }

  if (snapshot.nextCheckup) {
    parts.push(`Next appointment: ${snapshot.nextCheckup}.`);
  }

  if (snapshot.claraConversations.length) {
    parts.push(`Clara spoke with ${first} ${snapshot.claraConversations.length} time(s) — latest: ${snapshot.claraConversations[0].slice(0, 120)}.`);
  }

  if (snapshot.acseSignalsSinceCheckIn.length) {
    parts.push(`Recent cognitive signals: ${snapshot.acseSignalsSinceCheckIn.slice(0, 2).join('; ')}.`);
  }

  if (snapshot.alertsSinceCheckIn.length) {
    parts.push(`Active alert: ${snapshot.alertsSinceCheckIn[0]}.`);
  }

  if (snapshot.lastSleep) {
    parts.push(`Sleep last night: ${snapshot.lastSleep}.`);
  }

  return parts.join(' ');
}

/** Strip LLM output that references meds/events not present in snapshot. */
export function validateBriefingAgainstSnapshot(
  text: string,
  snapshot: SupervisorBriefingSnapshot
): string {
  if (!text.trim()) return text;

  const allowedMeds = [
    ...snapshot.medsTakenToday,
    ...snapshot.medsPending,
    ...snapshot.medsUnconfirmed,
    ...snapshot.dueMedsNow,
  ].flatMap((m) => m.toLowerCase().split(/[\s(,]+/)).filter((w) => w.length > 3);

  const knownEvents = [
    ...snapshot.eventsSinceCheckIn.map((e) => e.title),
    ...snapshot.upcomingToday,
    snapshot.nextCheckup ?? '',
  ].join(' ').toLowerCase();

  // If LLM mentions Clara but none recorded, append correction
  if (/clara/i.test(text) && snapshot.claraConversations.length === 0) {
    return `${text.replace(/\bclara\b[^.!?]*[.!?]/gi, '').trim()} No Clara voice conversations are recorded since your last check-in.`.trim();
  }

  // Drop invented med names (simple heuristic)
  const medMentions = text.match(/\b(Donepezil|Memantine|Levodopa|Tylenol|Metformin|Lisinopril)\b/gi) ?? [];
  for (const med of medMentions) {
    const lower = med.toLowerCase();
    const inData = allowedMeds.some((a) => a.includes(lower)) || knownEvents.includes(lower);
    if (!inData && !snapshot.medsPending.some((m) => m.toLowerCase().includes(lower))
        && !snapshot.medsTakenToday.some((m) => m.toLowerCase().includes(lower))) {
      return localSupervisorBriefing(snapshot);
    }
  }

  return text;
}
