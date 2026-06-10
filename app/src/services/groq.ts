import { GROQ_API_KEY } from '../env';
import { proxyPost, usesApiProxy, warnDirectApiKeys } from './apiClient';

const GROQ_BASE = 'https://api.groq.com/openai/v1';
const MODEL = 'llama-3.1-8b-instant';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function groqChat(messages: Message[]): Promise<string> {
  warnDirectApiKeys();

  if (usesApiProxy()) {
    try {
      const data = await proxyPost<{ content: string }>('/api/groq/chat', {
        model: MODEL,
        messages,
        max_tokens: 256,
        temperature: 0.7,
      });
      return data.content;
    } catch (err) {
      console.warn('Groq proxy failed, trying direct API:', err);
      if (!GROQ_API_KEY?.trim()) throw err;
    }
  }

  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      max_tokens: 256,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

export interface EventContext {
  lastCompleted?: string;
  nextPlanned?: string;
  recentEvents: string[];
  upcomingEvents: string[];
}

export async function reconstructState(
  userName: string,
  city: string,
  caregiverName: string,
  ctx: EventContext
): Promise<string> {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dayStr = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  const recentList = ctx.recentEvents.length
    ? ctx.recentEvents.slice(0, 3).join('; ')
    : 'no recent events';
  const upcomingList = ctx.upcomingEvents.length
    ? ctx.upcomingEvents.slice(0, 2).join('; ')
    : 'nothing scheduled';

  const prompt = `You are helping ${userName} understand their current reality. Write ONE warm, comforting sentence (max 40 words) in second person that reads like:
"You are at home in [city]. It is [day/time]. [Recent event]. Next: [upcoming event]."
Use exactly this data:
- Name: ${userName}
- City: ${city}
- Caregiver: ${caregiverName} (${caregiverName} is their caregiver)
- Current time: ${timeStr} on ${dayStr}
- Recent: ${recentList}
- Upcoming: ${upcomingList}
Write ONLY the sentence. No quotes. No intro. Warm and simple.`;

  try {
    return await groqChat([{ role: 'user', content: prompt }]);
  } catch {
    return `You are at home in ${city}. It is ${timeStr} on ${dayStr}. ${caregiverName} is here to help.`;
  }
}

const CLARA_SYSTEM = `You are Clara, a warm, patient companion for an elderly person with memory loss. Speak simply. Use short sentences. Never use jargon. Repeat important things gently. If the user seems confused or asks the same question twice, respond with extra patience. You have access to the user's name, current time, today's schedule, and recent events. Always be comforting, never clinical. Occasionally use their first name. Always answer in 2-3 sentences max unless asked for more.`;

export async function claraChat(
  userMessage: string,
  history: Message[],
  userName: string,
  ctx: EventContext
): Promise<string> {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dayStr = now.toLocaleDateString([], { weekday: 'long' });

  const contextNote = `[Context: User is ${userName}. Time is ${timeStr} on ${dayStr}. Recent events: ${ctx.recentEvents.slice(0, 5).join('; ') || 'none'}. Upcoming: ${ctx.upcomingEvents.slice(0, 3).join('; ') || 'none'}.]`;

  const messages: Message[] = [
    { role: 'system', content: CLARA_SYSTEM + '\n' + contextNote },
    ...history.slice(-10),
    { role: 'user', content: userMessage },
  ];

  try {
    return await groqChat(messages);
  } catch {
    return `I'm here with you, ${userName}. It's ${timeStr} right now. How can I help?`;
  }
}

export async function generateGrounding(
  userName: string,
  city: string,
  ctx: EventContext
): Promise<string> {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dayStr = now.toLocaleDateString([], { weekday: 'long' });

  const prompt = `Write a short, gentle grounding message (2-3 sentences) for ${userName} who has dementia. Use simple language. Start with reassurance that they are safe. Mention the day and time. Include one comforting fact from their day.
Data: time=${timeStr}, day=${dayStr}, city=${city}, recent events: ${ctx.recentEvents.slice(0, 3).join('; ') || 'resting at home'}.
Write ONLY the message. No quotes. Warm and simple.`;

  try {
    return await groqChat([{ role: 'user', content: prompt }]);
  } catch {
    return `You are safe at home in ${city}. It is ${dayStr} at ${timeStr}. You are doing wonderfully.`;
  }
}

export async function generateNarrative(
  userName: string,
  events: string[]
): Promise<string> {
  const prompt = `Write a brief, warm narrative (2-3 sentences) summarizing ${userName}'s day so far. Use second person ("you"). Simple, past tense, comforting. Events: ${events.join('; ') || 'a quiet, restful day at home'}.
Write ONLY the narrative. No quotes.`;

  try {
    return await groqChat([{ role: 'user', content: prompt }]);
  } catch {
    return `Today has been a calm, gentle day for you, ${userName}. You spent time resting and taking care of yourself.`;
  }
}

export interface MemoryAnchor {
  title: string;
  emoji: string;
  anchorText: string;
  speakText: string;
}

export async function generateMemoryAnchors(
  userName: string,
  city: string,
  caregiverName: string,
  relationship: string,
  recentEvents: string[],
  caregiverNotes: string[] = []
): Promise<MemoryAnchor[]> {
  const notesBlock = caregiverNotes.length
    ? `Caregiver journal today: ${caregiverNotes.slice(0, 3).join('; ')}.`
    : '';
  const prompt = `Create exactly 4 memory anchors for ${userName}, age with dementia, living in ${city}. Caregiver: ${caregiverName} (${relationship}). Recent today: ${recentEvents.slice(0, 4).join('; ') || 'quiet morning at home'}. ${notesBlock}

Each anchor is a grounding touchstone — a person, place, routine, or sensory memory that orients them when confused.

Return ONLY valid JSON array (no markdown):
[{"title":"short label","emoji":"single emoji","anchorText":"one warm sentence on card","speakText":"2 sentences Clara would say aloud, simple words"}]

Make anchors specific, loving, and believable for a New England senior.`;

  try {
    const raw = await groqChat([{ role: 'user', content: prompt }]);
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as MemoryAnchor[];
      if (Array.isArray(parsed) && parsed.length >= 3) {
        return parsed.slice(0, 4).map((a) => ({
          title: a.title || 'A familiar moment',
          emoji: a.emoji || '🌸',
          anchorText: a.anchorText || 'You are safe and loved.',
          speakText: a.speakText || a.anchorText || 'You are safe and loved.',
        }));
      }
    }
  } catch {
    /* fall through */
  }

  const first = userName.split(' ')[0];
  return [
    {
      title: `${caregiverName}'s voice`,
      emoji: '💛',
      anchorText: `${caregiverName} loves you and checks on you every day.`,
      speakText: `${first}, ${caregiverName} is your ${relationship}. She loves you very much and is always thinking of you.`,
    },
    {
      title: `Home in ${city.split(',')[0]}`,
      emoji: '🏡',
      anchorText: `Your cozy home in ${city} — familiar and safe.`,
      speakText: `You are at home in ${city}. This is your safe place. Everything here is familiar.`,
    },
    {
      title: 'Morning garden',
      emoji: '🌷',
      anchorText: 'The flowers you tend each morning are waiting for you.',
      speakText: `Remember your morning walks? The garden is peaceful. You have always loved the flowers.`,
    },
    {
      title: 'Today so far',
      emoji: '☀️',
      anchorText: recentEvents[0] ?? 'You have had a gentle, caring day.',
      speakText: `Today you have been taking good care of yourself. ${recentEvents[0] ?? 'You rested peacefully at home.'}`,
    },
  ];
}
