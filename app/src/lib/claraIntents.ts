import type { ClaraRichContext } from './claraContext';
import { detectLoneliness } from './memoryRecap';

export type ClaraIntent =
  | 'general'
  | 'identity'
  | 'location'
  | 'time_date'
  | 'caregiver'
  | 'schedule'
  | 'medication'
  | 'loneliness'
  | 'disorientation'
  | 'greeting'
  | 'thanks'
  | 'add_routine'
  | 'query_routine';

export type ClaraCascade = 'memory_recap' | 'comfort_mode' | 'none';

export type MemoryRecapReason = 'manual' | 'loneliness' | 'identity' | 'disorientation';

export interface ClaraIntentResult {
  intent: ClaraIntent;
  cascade: ClaraCascade;
  recapReason?: MemoryRecapReason;
  /** When true, use getTailoredResponse instead of waiting on the LLM for the first line */
  tailoredFirst: boolean;
}

const IDENTITY_PATTERNS = [
  /\bwhat('?s| is) my name\b/i,
  /\bwho am i\b/i,
  /\bdo you know (my name|who i am)\b/i,
  /\bwhat am i called\b/i,
];

const LOCATION_PATTERNS = [
  /\bwhere am i\b/i,
  /\bwhere are we\b/i,
  /\bwhat (is this|place is this)\b/i,
  /\bi'?m lost\b/i,
  /\bi am lost\b/i,
  /\bi feel lost\b/i,
  /\bcan'?t find (my way|home)\b/i,
  /\bdon'?t know where i am\b/i,
];

const TIME_PATTERNS = [
  /\bwhat (day|time|date) is (it|today)\b/i,
  /\bwhat day is (it|today)\b/i,
  /\bwhat time is it\b/i,
];

const CAREGIVER_PATTERNS = [
  /\bwho is my caregiver\b/i,
  /\bwho (is|are) (susan|my daughter|my son|my family)\b/i,
  /\bwho takes care of me\b/i,
  /\bwho checks on me\b/i,
];

const SCHEDULE_PATTERNS = [
  /\bwhat (do i|should i) (have to )?do\b/i,
  /\bwhat('?s| is) (next|on my schedule|my plan)\b/i,
  /\bwhat did i do today\b/i,
  /\bwhat have i done\b/i,
  /\bwhat('?s| is) coming up\b/i,
  /\banything (planned|scheduled)\b/i,
];

const MED_PATTERNS = [
  /\b(medication|medicine|meds|pills)\b/i,
  /\bdid i take\b/i,
  /\bwhen (do i|should i) take\b/i,
];

const DISORIENTATION_PATTERNS = [
  /\bi don'?t (know|remember|understand)\b/i,
  /\bhelp me\b/i,
  /\bwhat did i\b/i,
  /\bwho are you\b/i,
  /\bwhere is\b.*\b(my|the)\b/i,
];

const ADD_ROUTINE_PATTERNS = [
  /\badd (.+?) to (my )?routine\b/i,
  /\bremind me to (.+?) at\b/i,
  /\bput (.+?) on my (schedule|routine)\b/i,
  /\badd (.+?) at .+ to (my )?routine\b/i,
  /\bschedule (.+?) at\b/i,
];

const QUERY_ROUTINE_PATTERNS = [
  /\bwhat('?s| is) on my routine\b/i,
  /\bwhat do i have today\b/i,
  /\bwhat('?s| is) my (daily )?routine\b/i,
  /\bshow me my routine\b/i,
  /\bwhat('?s| is) on my (schedule|list) today\b/i,
];

const GREETING_PATTERNS = [
  /^(hi|hello|hey|good morning|good afternoon|good evening)\b/i,
];

const THANKS_PATTERNS = [
  /\b(thank you|thanks|appreciate)\b/i,
];

export function detectClaraIntent(text: string): ClaraIntentResult {
  const t = text.trim();

  if (detectLoneliness(t)) {
    return { intent: 'loneliness', cascade: 'memory_recap', recapReason: 'loneliness', tailoredFirst: true };
  }

  if (IDENTITY_PATTERNS.some((p) => p.test(t))) {
    return {
      intent: 'identity',
      cascade: 'memory_recap',
      recapReason: 'identity',
      tailoredFirst: true,
    };
  }

  if (LOCATION_PATTERNS.some((p) => p.test(t))) {
    return {
      intent: 'location',
      cascade: 'comfort_mode',
      tailoredFirst: true,
    };
  }

  if (TIME_PATTERNS.some((p) => p.test(t))) {
    return { intent: 'time_date', cascade: 'none', tailoredFirst: true };
  }

  if (CAREGIVER_PATTERNS.some((p) => p.test(t))) {
    return { intent: 'caregiver', cascade: 'none', tailoredFirst: true };
  }

  if (SCHEDULE_PATTERNS.some((p) => p.test(t))) {
    return { intent: 'schedule', cascade: 'none', tailoredFirst: true };
  }

  if (MED_PATTERNS.some((p) => p.test(t))) {
    return { intent: 'medication', cascade: 'none', tailoredFirst: true };
  }

  if (DISORIENTATION_PATTERNS.some((p) => p.test(t))) {
    return {
      intent: 'disorientation',
      cascade: 'comfort_mode',
      tailoredFirst: true,
    };
  }

  if (ADD_ROUTINE_PATTERNS.some((p) => p.test(t))) {
    return { intent: 'add_routine', cascade: 'none', tailoredFirst: true };
  }

  if (QUERY_ROUTINE_PATTERNS.some((p) => p.test(t))) {
    return { intent: 'query_routine', cascade: 'none', tailoredFirst: true };
  }

  if (GREETING_PATTERNS.some((p) => p.test(t))) {
    return { intent: 'greeting', cascade: 'none', tailoredFirst: true };
  }

  if (THANKS_PATTERNS.some((p) => p.test(t))) {
    return { intent: 'thanks', cascade: 'none', tailoredFirst: true };
  }

  return { intent: 'general', cascade: 'none', tailoredFirst: false };
}

/** Warm, factual replies for high-signal intents — used alone or while LLM is loading. */
export function getTailoredResponse(intent: ClaraIntent, ctx: ClaraRichContext): string {
  const { firstName, userName, city, homeAddress, caregiverName, caregiverRelationship, timeStr, dayStr } = ctx;

  switch (intent) {
    case 'identity':
      return `Oh ${firstName} — you're ${userName}. You're ${ctx.age}, and you're safe at home${homeAddress ? ` on ${homeAddress.split(',')[0]}` : ` in ${city}`}. ${caregiverName}, your ${caregiverRelationship}, loves you very much.`;

    case 'location':
      return `You're at home, sweetheart — ${homeAddress ?? city}. This is your safe place. It's ${timeStr} on ${dayStr}, and everything is alright.`;

    case 'time_date':
      return `It's ${timeStr} on ${dayStr}, ${firstName}. You're right where you belong — at home in ${city.split(',')[0]}.`;

    case 'caregiver':
      return `${caregiverName} is your ${caregiverRelationship}, and she checks on you regularly. She loves you dearly, ${firstName}.`;

    case 'loneliness':
      return `Oh ${firstName}, I hear you. You're not alone — ${caregiverName} is thinking of you, and your family adores you. Let me show you some cherished photos.`;

    case 'disorientation':
      return `It's alright, ${firstName}. You're safe at home. It's ${timeStr} on ${dayStr}. Take a slow breath with me — I'm right here.`;

    case 'schedule': {
      const parts: string[] = [];
      if (ctx.completedToday.length) {
        parts.push(`today you've already ${ctx.completedToday[0].toLowerCase()}`);
      }
      if (ctx.upcomingToday.length) {
        parts.push(`coming up: ${ctx.upcomingToday.slice(0, 2).join(', and ')}`);
      } else if (ctx.pendingRoutines.length) {
        parts.push(`still on your list: ${ctx.pendingRoutines.slice(0, 2).join(' and ')}`);
      }
      if (parts.length) {
        return `Well ${firstName}, ${parts.join('. ')}. We can take it one step at a time.`;
      }
      return `${firstName}, it's a gentle day — no rush. You might enjoy a walk in the garden or chatting with me a while.`;
    }

    case 'medication': {
      const lines = ctx.medications.map((m) =>
        m.takenToday ? `${m.name} — already taken today` : `${m.name} ${m.dosage} (${m.schedule})`
      );
      if (ctx.dueMedsNow.length) {
        return `${firstName}, ${ctx.dueMedsNow[0]} is due soon. Your medicines today: ${lines.join('; ')}.`;
      }
      return `Your medicines are ${lines.join(', ')}. ${caregiverName} helps make sure you stay on track.`;
    }

    case 'query_routine': {
      if (ctx.routineEvents.length === 0) {
        return `You don't have any routine items set up yet, ${firstName}. You can ask me to add something and I'll take care of it.`;
      }
      const done = ctx.routineEvents.filter((e) => e.done);
      const pending = ctx.routineEvents.filter((e) => !e.done);
      const parts: string[] = [];
      if (done.length) parts.push(`You've already completed ${done.map((e) => e.name).join(', ')}`);
      if (pending.length) {
        const next = pending.slice(0, 3).map((e) => e.time ? `${e.name} at ${e.time}` : e.name).join(', ');
        parts.push(`still coming up: ${next}`);
      }
      return `${firstName}, here's your routine today. ${parts.join('. ')}.`;
    }

    case 'add_routine':
      return `I've added that to your routine, ${firstName}. You can check it in the Routine tab.`;

    case 'greeting':
      return `Hello, ${firstName}! It's ${timeStr}. I'm so glad you're here — what's on your mind?`;

    case 'thanks':
      return `You're so welcome, ${firstName}. I'm always happy to sit with you.`;

    default:
      return `I'm here with you, ${firstName}. Tell me more — I'd love to hear what's on your mind.`;
  }
}
