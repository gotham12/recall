import { GROQ_API_KEY } from '../env';
import { proxyPost, usesApiProxy, warnDirectApiKeys } from './apiClient';
import {
  type ClaraRichContext,
  formatClaraContextBlock,
} from '../lib/claraContext';
import { localClaraReply } from '../lib/claraLocal';
import { openRouterClaraChat, openRouterRecallAIChat } from './openrouter';
import { localRecallAIReply } from '../lib/recallAILocal';
import type { SupervisorBriefingSnapshot } from '../lib/supervisorBriefing';

const GROQ_BASE = 'https://api.groq.com/openai/v1';
/** Client model hint — worker uses Cloudflare Workers AI (Llama 3.1) server-side */
const MODEL_PRIMARY = 'llama-3.3-70b-versatile';
const MODEL_FALLBACK = 'llama-3.1-8b-instant';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GroqOptions {
  model?: string;
  max_tokens?: number;
  temperature?: number;
}

async function groqChat(messages: Message[], opts: GroqOptions = {}): Promise<string> {
  const model = opts.model ?? MODEL_PRIMARY;
  const max_tokens = opts.max_tokens ?? 320;
  const temperature = opts.temperature ?? 0.78;
  warnDirectApiKeys();

  const payload = { model, messages, max_tokens, temperature };

  // Direct Groq first when key is available — faster than proxy waterfall
  if (GROQ_API_KEY?.trim()) {
    try {
      const res = await fetch(`${GROQ_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content?.trim() ?? '';
        if (text) return text;
      }
    } catch (err) {
      console.warn('[Clara] Direct Groq failed, trying proxy:', err);
    }
  }

  if (usesApiProxy()) {
    try {
      const data = await proxyPost<{ content: string }>('/api/groq/chat', payload);
      const text = data.content?.trim();
      if (text) return text;
    } catch (err) {
      console.warn('Groq proxy failed:', err);
    }
  }

  throw new Error('Groq not configured or all paths failed');
}

async function groqChatWithFallback(messages: Message[]): Promise<string> {
  try {
    return await groqChat(messages, { model: MODEL_PRIMARY });
  } catch (primaryErr) {
    console.warn('Primary model failed, trying fallback:', primaryErr);
    return await groqChat(messages, { model: MODEL_FALLBACK, max_tokens: 280 });
  }
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

const CLARA_SYSTEM = `You are Clara, a warm, trusted companion who speaks with Margaret, an elderly woman who sometimes forgets. You are NOT an AI — you are like a caring daughter or lifelong friend on the phone.

You can talk about ANYTHING: her day, family, the garden, memories, how she's feeling, the weather, music, food, stories from her life. Be genuinely conversational.

Rules:
- Lead with warmth ("Oh, I'm so glad you told me," "That makes perfect sense").
- Use contractions and gentle openers: "Oh," "Well," "You know."
- 1–4 sentences. Plain words. No lists, bullets, or medical jargon.
- Use her first name once per reply — warmly, not mechanically.
- ALWAYS use the LIVE CONTEXT block for factual questions (name, schedule, meds, family, what she did today).
- If she's confused: slow down, reassure she's safe at home, anchor time and place. Never make her feel wrong.
- If she's sad or lonely: validate first, then warmth about family.
- Never say you are an AI, chatbot, language model, or assistant.
- Never echo her words back verbatim.
- End with warmth; not every reply needs a question.`;

export interface ClaraContext extends EventContext {
  caregiverName?: string;
  city?: string;
}

export interface ClaraChatResult {
  reply: string;
  fromLlm: boolean;
}

export async function claraChat(
  userMessage: string,
  history: Message[],
  userName: string,
  ctx: ClaraRichContext
): Promise<ClaraChatResult> {
  const firstName = userName.split(' ')[0];
  const contextBlock = formatClaraContextBlock(ctx);

  const messages: Message[] = [
    { role: 'system', content: CLARA_SYSTEM + '\n\n' + contextBlock },
    ...history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

  // Groq 70B first (fast) — OpenRouter Haiku as quality fallback
  try {
    const raw = await groqChatWithFallback(messages);
    return { reply: sanitizeClaraReply(raw, firstName), fromLlm: true };
  } catch (groqErr) {
    console.warn('[Clara] Groq failed, trying OpenRouter:', groqErr);
  }

  try {
    const raw = await openRouterClaraChat(messages);
    return { reply: sanitizeClaraReply(raw, firstName), fromLlm: true };
  } catch (openRouterErr) {
    console.warn('[Clara] OpenRouter failed, using local reply:', openRouterErr);
  }

  const chatHistory = history
    .filter((m): m is Message & { role: 'user' | 'assistant' } => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: m.content }));
  return {
    reply: localClaraReply(userMessage, ctx, chatHistory),
    fromLlm: false,
  };
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

export async function generateSupervisorBriefing(
  contextBlock: string,
  localFallback: string
): Promise<{ text: string; fromLlm: boolean }> {
  const prompt = `You are Recall's care assistant briefing a family caregiver about their loved one with dementia.

Write a warm, factual briefing (4–6 sentences) in second person ("you").

STRICT RULES:
- Use ONLY facts explicitly listed in DATA below. Do not invent medications, events, Clara conversations, or appointments.
- If Clara conversations says "none recorded", do NOT mention Clara interactions.
- If next checkup says "none scheduled", do NOT mention a doctor visit.
- ACSE: higher is better; below the comfort threshold is concerning.
- Only suggest a specific action if DATA lists a pending med, unverified med, alert, or upcoming appointment.
- Do not use bullet points.

DATA:
${contextBlock}

Write ONLY the briefing paragraph. No quotes.`;

  try {
    const raw = await groqChat([{ role: 'user', content: prompt }], { max_tokens: 300, temperature: 0.25 });
    const text = raw.replace(/^["']|["']$/g, '').replace(/\*\*/g, '').trim();
    if (text.length > 40) return { text, fromLlm: true };
  } catch (err) {
    console.warn('[Supervisor briefing] LLM unavailable:', err);
  }

  return { text: localFallback, fromLlm: false };
}

const RECALL_AI_SYSTEM = `You are Recall AI, an expert care advisor for family caregivers of older adults with neurodegenerative conditions (Alzheimer's, Parkinson's, Lewy body, vascular dementia, and related disorders).

Your user is the SUPERVISOR/CAREGIVER — not the patient. Speak to them directly ("you") with warmth and clinical clarity.

You CAN discuss:
- Medication adherence, timing, and what to watch for (never prescribe or change doses — defer to their physician)
- ACSE cognitive stability scores and what trends mean
- Sundowning, disorientation, repetition, and de-escalation strategies
- Comfort Mode, Clara companion interactions, and Recall app features
- Appointment prep, questions for neurologists, and care planning
- Caregiver burnout, safety, fall risk, nutrition, sleep, and daily structure
- Treatment OPTIONS in general education terms (benefits, tradeoffs, lifestyle) — always note "confirm with her doctor"

Rules:
- Ground answers in LIVE PATIENT DATA when provided. Do not invent labs, diagnoses, or events not in the data.
- If data is missing, say so and suggest what to log in Recall or ask at the next visit.
- 2–6 sentences for voice-friendly replies; up to 2 short paragraphs for complex treatment questions.
- No markdown, bullets, or numbered lists — flowing prose only.
- Include a brief disclaimer when giving treatment-style guidance: remind them to confirm with the medical team.
- Never claim to be a doctor or replace emergency services. For emergencies, say to call 911.
- Use the patient's first name naturally when referring to them.`;

export interface RecallAIChatResult {
  reply: string;
  fromLlm: boolean;
}

function sanitizeRecallAIReply(text: string): string {
  let reply = text
    .replace(/^["']|["']$/g, '')
    .replace(/\*\*/g, '')
    .replace(/^Recall AI:\s*/i, '')
    .replace(/^Assistant:\s*/i, '')
    .trim();
  if (reply.length > 900) {
    const cut = reply.slice(0, 880);
    const lastStop = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('!'), cut.lastIndexOf('?'));
    reply = lastStop > 200 ? cut.slice(0, lastStop + 1) : cut + '…';
  }
  return reply || "I'm here to help with Margaret's care — what would you like to know?";
}

export async function recallAIChat(
  userMessage: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  contextBlock: string,
  caregiverName: string,
  snapshot: SupervisorBriefingSnapshot
): Promise<RecallAIChatResult> {
  const messages: Message[] = [
    {
      role: 'system',
      content: `${RECALL_AI_SYSTEM}\n\nCaregiver speaking: ${caregiverName}\n\n${contextBlock}`,
    },
    ...history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-14)
      .map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

  try {
    const raw = await openRouterRecallAIChat(messages);
    return { reply: sanitizeRecallAIReply(raw), fromLlm: true };
  } catch (openRouterErr) {
    console.warn('[Recall AI] OpenRouter failed, trying Groq:', openRouterErr);
  }

  try {
    const raw = await groqChat(messages, { model: MODEL_PRIMARY, max_tokens: 600, temperature: 0.55 });
    return { reply: sanitizeRecallAIReply(raw), fromLlm: true };
  } catch (primaryErr) {
    console.warn('[Recall AI] Groq primary failed, trying fallback:', primaryErr);
    try {
      const raw = await groqChat(messages, { model: MODEL_FALLBACK, max_tokens: 500, temperature: 0.55 });
      return { reply: sanitizeRecallAIReply(raw), fromLlm: true };
    } catch (err) {
      console.warn('[Recall AI] LLM unavailable, using local advisor:', err);
      return {
        reply: localRecallAIReply(userMessage, snapshot, caregiverName),
        fromLlm: false,
      };
    }
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
[{"title":"short label","emoji":"","anchorText":"one warm sentence on card","speakText":"2 sentences Clara would say aloud, simple words"}]

Make anchors specific, loving, and believable for a New England senior.`;

  try {
    const raw = await groqChat([{ role: 'user', content: prompt }]);
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as MemoryAnchor[];
      if (Array.isArray(parsed) && parsed.length >= 3) {
        return parsed.slice(0, 4).map((a) => ({
          title: a.title || 'A familiar moment',
          emoji: '',
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
      emoji: '',
      anchorText: `${caregiverName} loves you and checks on you every day.`,
      speakText: `${first}, ${caregiverName} is your ${relationship}. She loves you very much and is always thinking of you.`,
    },
    {
      title: `Home in ${city.split(',')[0]}`,
      emoji: '',
      anchorText: `Your cozy home in ${city} — familiar and safe.`,
      speakText: `You are at home in ${city}. This is your safe place. Everything here is familiar.`,
    },
    {
      title: 'Morning garden',
      emoji: '',
      anchorText: 'The flowers you tend each morning are waiting for you.',
      speakText: `Remember your morning walks? The garden is peaceful. You have always loved the flowers.`,
    },
    {
      title: 'Today so far',
      emoji: '',
      anchorText: recentEvents[0] ?? 'You have had a gentle, caring day.',
      speakText: `Today you have been taking good care of yourself. ${recentEvents[0] ?? 'You rested peacefully at home.'}`,
    },
  ];
}
