import { db, type User } from '../db/db';
import { isMedicationDueSoon } from './schedule';
import { analyzeSleep, formatSleepDuration, lastNightDate, qualityLabel } from './sleep';
import { loadRoutineEvents, loadTodayCompletions } from './routineUtils';

export interface ClaraRichContext {
  userName: string;
  firstName: string;
  age: number;
  city: string;
  homeAddress?: string;
  caregiverName: string;
  caregiverRelationship: string;
  caregiverPhone?: string;
  acseScore: number;
  timeStr: string;
  dayStr: string;
  completedToday: string[];
  upcomingToday: string[];
  pendingRoutines: string[];
  completedRoutines: string[];
  medications: { name: string; dosage: string; schedule: string; takenToday: boolean }[];
  dueMedsNow: string[];
  lastSleep?: string;
  familiarFaces: string[];
  recentActivity: string[];
  emergencyNote?: string;
  /** Routine events from localStorage (SimpleRoutineChecklist) */
  routineEvents: { name: string; time: string; done: boolean }[];
}

function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Pull everything Recall knows about Margaret into one context block for Clara. */
export async function buildClaraRichContext(
  user: User | null,
  acseScore = 100
): Promise<ClaraRichContext> {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dayStr = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  const start = todayStart();
  const userId = user?.id ?? 1;
  const [events, routines, medLogs, sleepLogs, faces] = await Promise.all([
    db.events.where('userId').equals(userId).toArray(),
    db.routineTasks.where('userId').equals(userId).sortBy('sortOrder'),
    db.medicationLogs.where('userId').equals(userId).toArray(),
    db.sleepLogs.where('userId').equals(userId).toArray(),
    db.familiarFaces.where('userId').equals(userId).toArray(),
  ]);

  const todayEvents = events.filter((e) => new Date(e.timestamp) >= start);
  const completedToday = todayEvents
    .filter((e) => e.completed)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .map((e) => `${e.title}${e.description ? ` — ${e.description}` : ''}`);

  const upcomingToday = events
    .filter((e) => !e.completed && new Date(e.timestamp) > now)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(0, 5)
    .map((e) => `${e.title} at ${new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);

  const todayMedNames = new Set(
    medLogs
      .filter((l) => new Date(l.timestamp) >= start && l.confirmed !== false)
      .map((l) => l.medicationName.toLowerCase())
  );

  const medications = (user?.medications ?? []).map((m) => ({
    name: m.name,
    dosage: m.dosage,
    schedule: m.schedule.join(', '),
    takenToday: todayMedNames.has(m.name.toLowerCase()),
  }));

  const dueMedsNow = (user?.medications ?? [])
    .filter((m) => isMedicationDueSoon(m.schedule) && !todayMedNames.has(m.name.toLowerCase()))
    .map((m) => `${m.name} (${m.dosage})`);

  const pendingRoutines = routines
    .filter((r) => !r.completedAt)
    .map((r) => `${r.label} (${r.period})`);

  const completedRoutines = routines
    .filter((r) => r.completedAt && new Date(r.completedAt) >= start)
    .map((r) => r.label);

  const lastNight = sleepLogs.find((l) => l.date === lastNightDate());
  let lastSleep: string | undefined;
  if (lastNight) {
    const report = analyzeSleep(sleepLogs);
    const night = report.nights.find((n) => n.date === lastNight.date);
    if (night) {
      lastSleep = `${formatSleepDuration(night.durationHours)}, ${qualityLabel(lastNight.quality)}`;
    }
  }

  const familiarFaces = faces.map((f) => `${f.name} (${f.relationship})`);

  const recentActivity = [
    ...completedToday.slice(0, 4),
    ...completedRoutines.map((r) => `Routine done: ${r}`),
  ].slice(0, 6);

  const firstName = user?.name?.split(' ')[0] ?? 'friend';

  // Load routine events from localStorage (SimpleRoutineChecklist)
  const lsRoutineEvents = loadRoutineEvents();
  const lsCompletions = loadTodayCompletions();
  const routineEvents = lsRoutineEvents.map((e) => ({
    name: e.name,
    time: e.time,
    done: Boolean(lsCompletions[e.id]),
  }));

  return {
    userName: user?.name ?? 'Margaret',
    firstName,
    age: user?.age ?? 78,
    city: user?.city ?? 'home',
    homeAddress: user?.homeAddress,
    caregiverName: user?.caregiverName ?? 'Susan',
    caregiverRelationship: user?.caregiverRelationship ?? 'daughter',
    caregiverPhone: user?.caregiverPhone,
    acseScore,
    timeStr,
    dayStr,
    completedToday,
    upcomingToday,
    pendingRoutines,
    completedRoutines,
    medications,
    dueMedsNow,
    lastSleep,
    familiarFaces,
    recentActivity,
    emergencyNote: user?.emergencyNote,
    routineEvents,
  };
}

/** Serialize context for the LLM system prompt. */
export function formatClaraContextBlock(ctx: ClaraRichContext): string {
  const medLines = ctx.medications.length
    ? ctx.medications.map((m) =>
        `  • ${m.name} ${m.dosage} (${m.schedule})${m.takenToday ? ' — taken today ✓' : ''}`
      ).join('\n')
    : '  • none on file';

  return `[LIVE CONTEXT — use this to answer Margaret's questions accurately]

About ${ctx.firstName}:
- Full name: ${ctx.userName}, age ${ctx.age}
- Home: ${ctx.homeAddress ?? ctx.city}
- Caregiver: ${ctx.caregiverName} (${ctx.caregiverRelationship})${ctx.caregiverPhone ? `, phone on file` : ''}
- Right now: ${ctx.timeStr} on ${ctx.dayStr}
- Stability score (internal): ${ctx.acseScore}/100 — do not mention numbers unless asked

Today so far:
${ctx.completedToday.length ? ctx.completedToday.map((e) => `  • ${e}`).join('\n') : '  • quiet morning, nothing logged yet'}

Coming up:
${ctx.upcomingToday.length ? ctx.upcomingToday.map((e) => `  • ${e}`).join('\n') : '  • nothing urgent scheduled'}

Routines still to do:
${ctx.pendingRoutines.length ? ctx.pendingRoutines.map((r) => `  • ${r}`).join('\n') : '  • all done for now'}

Medications:
${medLines}
${ctx.dueMedsNow.length ? `Due soon: ${ctx.dueMedsNow.join(', ')}` : ''}

${ctx.lastSleep ? `Last night's sleep: ${ctx.lastSleep}` : ''}

Family & familiar faces: ${ctx.familiarFaces.join(', ') || 'Susan and Robert'}

You can discuss everyday topics — weather, memories, how she's feeling, family stories, hobbies, the garden, music. Ground answers in this context when relevant.`;
}
