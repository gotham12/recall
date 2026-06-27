import { db, type User } from '../db/db';
import { isMedicationDueSoon } from './schedule';
import { analyzeSleep, formatSleepDuration, lastNightDate, qualityLabel } from './sleep';
import { loadRoutineEvents, loadTodayCompletions } from './routineUtils';
import { buildSafetyContacts } from './safetyContacts';
import { getHealthVitals } from './appleHealthVitals';
import { isAppleHealthConnected } from './appleHealthSleep';

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
  comfortModeActive: boolean;
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
  familiarFacesDetail: { name: string; relationship: string }[];
  safetyCircle: { name: string; relationship: string; phone: string; primary?: boolean }[];
  recentActivity: string[];
  emergencyNote?: string;
  routineEvents: { name: string; time: string; done: boolean }[];
  vitalsSummary?: string;
  appleHealthConnected: boolean;
  allEventsUpcoming: string[];
}

function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Pull everything Recall knows about the patient — shared by Clara and Recall AI. */
export async function buildClaraRichContext(
  user: User | null,
  acseScore = 100,
  comfortModeActive = false
): Promise<ClaraRichContext> {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dayStr = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  const start = todayStart();
  const userId = user?.id ?? 1;
  const [events, routines, medLogs, sleepLogs, faces, emergencyContacts] = await Promise.all([
    db.events.where('userId').equals(userId).toArray(),
    db.routineTasks.where('userId').equals(userId).sortBy('sortOrder'),
    db.medicationLogs.where('userId').equals(userId).toArray(),
    db.sleepLogs.where('userId').equals(userId).toArray(),
    db.familiarFaces.where('userId').equals(userId).toArray(),
    db.emergencyContacts.where('userId').equals(userId).toArray(),
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
  const familiarFacesDetail = faces.map((f) => ({ name: f.name, relationship: f.relationship }));

  const caregiver = user?.caregiverName
    ? {
        name: user.caregiverName,
        relationship: user.caregiverRelationship ?? 'caregiver',
        phone: user.caregiverPhone ?? '',
      }
    : null;
  const safetyCircle = buildSafetyContacts(caregiver, emergencyContacts).map((c) => ({
    name: c.name,
    relationship: c.relationship,
    phone: c.phone,
    primary: c.primary,
  }));

  const allEventsUpcoming = events
    .filter((e) => !e.completed && new Date(e.timestamp) > now)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(0, 8)
    .map((e) => `${e.title} — ${new Date(e.timestamp).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`);

  let vitalsSummary: string | undefined;
  const appleHealthConnected = Boolean(user?.id && isAppleHealthConnected(user.id));
  if (user?.id) {
    const vitals = getHealthVitals(user.id);
    if (vitals) {
      vitalsSummary = `HR ${vitals.heartRate} bpm, RR ${vitals.respiratoryRate}/min, temp ${vitals.bodyTempF}°F, BP ${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic}, walking ${vitals.walkingSpeedMph} mph (${vitals.deviceName ?? 'Apple Watch'})`;
    }
  }

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
    comfortModeActive,
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
    familiarFacesDetail,
    safetyCircle,
    recentActivity,
    emergencyNote: user?.emergencyNote,
    routineEvents,
    vitalsSummary,
    appleHealthConnected,
    allEventsUpcoming,
  };
}

/** Serialize context for the LLM system prompt. */
export function formatClaraContextBlock(ctx: ClaraRichContext): string {
  const medLines = ctx.medications.length
    ? ctx.medications.map((m) =>
        `  • ${m.name} ${m.dosage} (${m.schedule})${m.takenToday ? ' — taken today ✓' : ''}`
      ).join('\n')
    : '  • none on file';

  return `[LIVE PATIENT CONTEXT — Clara & Recall AI share this data]

About ${ctx.firstName}:
- Full name: ${ctx.userName}, age ${ctx.age}
- Home: ${ctx.homeAddress ?? ctx.city}
- Caregiver: ${ctx.caregiverName} (${ctx.caregiverRelationship})${ctx.caregiverPhone ? `, ${ctx.caregiverPhone}` : ''}
- Right now: ${ctx.timeStr} on ${ctx.dayStr}
- Stability score (ACSE): ${ctx.acseScore}/100
- Comfort Mode active: ${ctx.comfortModeActive ? 'yes' : 'no'}
${ctx.emergencyNote ? `- Emergency note: ${ctx.emergencyNote}` : ''}

Today so far:
${ctx.completedToday.length ? ctx.completedToday.map((e) => `  • ${e}`).join('\n') : '  • quiet morning, nothing logged yet'}

Coming up today:
${ctx.upcomingToday.length ? ctx.upcomingToday.map((e) => `  • ${e}`).join('\n') : '  • nothing urgent scheduled'}

All upcoming events:
${ctx.allEventsUpcoming.length ? ctx.allEventsUpcoming.map((e) => `  • ${e}`).join('\n') : '  • none scheduled'}

Daily routine checklist:
${ctx.routineEvents.length ? ctx.routineEvents.map((r) => `  • ${r.name}${r.time ? ` at ${r.time}` : ''}${r.done ? ' ✓' : ''}`).join('\n') : '  • none configured'}

DB routines still to do:
${ctx.pendingRoutines.length ? ctx.pendingRoutines.map((r) => `  • ${r}`).join('\n') : '  • all done for now'}

DB routines completed today:
${ctx.completedRoutines.length ? ctx.completedRoutines.map((r) => `  • ${r}`).join('\n') : '  • none yet'}

Medications:
${medLines}
${ctx.dueMedsNow.length ? `Due soon: ${ctx.dueMedsNow.join(', ')}` : ''}

${ctx.lastSleep ? `Last night's sleep: ${ctx.lastSleep}` : 'Sleep: not logged'}

${ctx.vitalsSummary ? `Apple Health vitals: ${ctx.vitalsSummary}` : `Apple Health: ${ctx.appleHealthConnected ? 'connected, vitals pending sync' : 'not connected'}`}

Familiar faces: ${ctx.familiarFaces.join(', ') || 'none on file'}

Safety circle:
${ctx.safetyCircle.length ? ctx.safetyCircle.map((c) => `  • ${c.name} (${c.relationship})${c.primary ? ' — primary' : ''}: ${c.phone}`).join('\n') : '  • none on file'}

Recent activity: ${ctx.recentActivity.join('; ') || 'none'}`;
}
