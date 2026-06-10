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
        max_tokens: 200,
        temperature: 0.65,
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
      max_tokens: 200,
      temperature: 0.65,
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

const CLARA_SYSTEM = `You are Clara, a warm, trusted friend who speaks with an elderly person who sometimes forgets. Rules:
- Sound like a real person on a phone call, not an AI or nurse.
- Use plain words. Short sentences. No lists, bullets, or medical jargon.
- 1–3 sentences unless they ask for more detail.
- Use their first name naturally once per reply, not every sentence.
- Ground answers in today's schedule and recent events when relevant.
- If they seem confused, lost, or repeat themselves: slow down, reassure, and anchor them in time and place.
- If they express loneliness: validate the feeling, remind them their family loves them, and suggest looking at family photos together.
- Never say you are an AI, language model, or assistant.
- Never quote or repeat back exactly what they just said.
- End with gentle warmth, not a question every time.`;

export interface ClaraContext extends EventContext {
  caregiverName?: string;
  city?: string;
}

export async function claraChat(
  userMessage: string,
  history: Message[],
  userName: string,
  ctx: ClaraContext
): Promise<string> {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dayStr = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  const firstName = userName.split(' ')[0];

  const contextNote = `[Live context for ${firstName}:
- Time: ${timeStr}, ${dayStr}
- Home: ${ctx.city ?? 'their home'}
- Caregiver: ${ctx.caregiverName ?? 'their family'} (checks in regularly)
- Done today: ${ctx.recentEvents.slice(0, 4).join('; ') || 'a calm morning so far'}
- Coming up: ${ctx.upcomingEvents.slice(0, 3).join('; ') || 'nothing urgent on the schedule'}]`;

  const messages: Message[] = [
    { role: 'system', content: CLARA_SYSTEM + '\n\n' + contextNote },
    ...history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

  try {
    const raw = await groqChat(messages);
    return sanitizeClaraReply(raw, firstName);
  } catch {
    return `I'm right here with you, ${firstName}. It's ${timeStr} — a good time to take things slowly.`;
  }
}

function sanitizeClaraReply(text: string, firstName: string): string {
  let reply = text
    .replace(/^["']|["']$/g, '')
    .replace(/\*\*/g, '')
    .replace(/^Clara:\s*/i, '')
    .trim();
  if (!reply) {
    return `I'm here, ${firstName}. Tell me what's on your mind.`;
  }
  if (reply.length > 420) {
    const cut = reply.slice(0, 400);
    const lastStop = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('!'), cut.lastIndexOf('?'));
    reply = lastStop > 80 ? cut.slice(0, lastStop + 1) : cut + '…';
  }
  return reply;
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
