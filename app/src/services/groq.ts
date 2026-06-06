const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY as string;
const BASE = 'https://api.groq.com/openai/v1';
const MODEL = 'llama-3.1-8b-instant';

interface Msg { role: 'system' | 'user' | 'assistant'; content: string; }

async function chat(messages: Msg[], maxTokens = 256): Promise<string> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, messages, max_tokens: maxTokens, temperature: 0.7 }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

export interface EventCtx {
  recentEvents: string[];
  upcomingEvents: string[];
}

export async function reconstructState(
  name: string, city: string, caregiver: string, ctx: EventCtx
): Promise<string> {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const day  = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  const recent   = ctx.recentEvents.slice(0, 3).join('; ') || 'no recent events';
  const upcoming = ctx.upcomingEvents.slice(0, 2).join('; ') || 'nothing scheduled';

  try {
    return await chat([{ role: 'user', content:
      `Write ONE warm comforting sentence (max 40 words) in second person for ${name} with memory loss.\n` +
      `Format: "You are at home in [city]. It is [day/time]. [Recent]. Next: [upcoming]."\n` +
      `Data: city=${city}, caregiver=${caregiver}, time=${time}, day=${day}, recent=${recent}, upcoming=${upcoming}.\n` +
      `Write ONLY the sentence. No quotes.`
    }]);
  } catch {
    return `You are at home in ${city}. It is ${time} on ${day}. ${caregiver} is here to help you.`;
  }
}

const CLARA_SYSTEM = `You are Clara, a warm patient companion for an elderly person with memory loss. Speak simply. Use short sentences. Never use jargon. Repeat important things gently. If the user seems confused or asks the same question twice, respond with extra patience. Always be comforting, never clinical. Occasionally use their first name. Always answer in 2-3 sentences max unless asked for more.`;

export async function claraChat(
  userMsg: string, history: Msg[], name: string, ctx: EventCtx
): Promise<string> {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const day  = now.toLocaleDateString([], { weekday: 'long' });
  const context = `[Context: User is ${name}. Time is ${time} on ${day}. Recent: ${ctx.recentEvents.slice(0,5).join('; ') || 'none'}. Upcoming: ${ctx.upcomingEvents.slice(0,3).join('; ') || 'none'}.]`;

  try {
    return await chat([
      { role: 'system', content: CLARA_SYSTEM + '\n' + context },
      ...history.slice(-10),
      { role: 'user', content: userMsg },
    ], 200);
  } catch {
    return `I am here with you, ${name}. It is ${time} right now. How can I help?`;
  }
}

export async function generateGrounding(name: string, city: string, ctx: EventCtx): Promise<string> {
  const now  = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const day  = now.toLocaleDateString([], { weekday: 'long' });
  const recent = ctx.recentEvents.slice(0, 3).join('; ') || 'resting at home';

  try {
    return await chat([{ role: 'user', content:
      `Write a short gentle grounding message (2-3 sentences) for ${name} who has dementia. Simple language. Start with reassurance they are safe. Mention day and time. Include one comforting fact.\n` +
      `Data: time=${time}, day=${day}, city=${city}, recent=${recent}.\nWrite ONLY the message. Warm and simple.`
    }], 150);
  } catch {
    return `You are safe at home in ${city}. It is ${day} at ${time}. You are doing wonderfully.`;
  }
}

export async function generateNarrative(name: string, events: string[]): Promise<string> {
  const list = events.join('; ') || 'a quiet restful day at home';
  try {
    return await chat([{ role: 'user', content:
      `Write a brief warm narrative (2-3 sentences) summarizing ${name}'s day. Second person. Simple past tense. Comforting. Events: ${list}.\nWrite ONLY the narrative. No quotes.`
    }], 150);
  } catch {
    return `Today has been a calm gentle day for you, ${name}. You spent time resting and taking care of yourself.`;
  }
}

export async function parseCaregiverMessage(msg: string): Promise<{ time: string | null; title: string; description: string }> {
  try {
    const result = await chat([{ role: 'user', content:
      `Parse this caregiver message into a calendar event JSON.\nMessage: "${msg}"\nRespond with ONLY valid JSON: { "time": "HH:MM or null", "title": "short title", "description": "full sentence" }`
    }], 100);
    return JSON.parse(result.replace(/```json?|```/g, '').trim());
  } catch {
    return { time: null, title: msg.slice(0, 40), description: msg };
  }
}
