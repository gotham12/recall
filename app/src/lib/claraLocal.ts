import type { ClaraRichContext } from './claraContext';
import { detectClaraIntent, getTailoredResponse } from './claraIntents';

interface HistoryMsg {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Context-aware replies when the LLM API is unreachable.
 * Still conversational — answers from Margaret's real Recall data.
 */
export function localClaraReply(
  userMessage: string,
  ctx: ClaraRichContext,
  history: HistoryMsg[]
): string {
  const intent = detectClaraIntent(userMessage);

  if (intent.tailoredFirst || intent.intent !== 'general') {
    return getTailoredResponse(intent.intent, ctx);
  }

  const lower = userMessage.toLowerCase();

  // Reflective / emotional
  if (/\b(sad|scared|worried|anxious|nervous|upset)\b/i.test(lower)) {
    return `Oh ${ctx.firstName}, I understand. You're safe here at home, and ${ctx.caregiverName} cares about you deeply. Would you like to talk about it?`;
  }

  if (/\b(happy|good|wonderful|great|lovely)\b/i.test(lower)) {
    return `That makes me so glad to hear, ${ctx.firstName}. Days like this are precious.`;
  }

  if (/\b(weather|cold|warm|rain|sunny)\b/i.test(lower)) {
    return `It's ${ctx.timeStr} here in ${ctx.city.split(',')[0]}. A good day to be cozy at home, ${ctx.firstName}.`;
  }

  if (/\b(garden|flowers|plants|porch)\b/i.test(lower)) {
    return `Oh, the garden — you always loved tending the flowers on Maple Lane. ${ctx.familiarFaces[0] ? `Maybe ${ctx.familiarFaces[0].split(' ')[0]} would love to hear about it.` : ''}`;
  }

  if (/\b(family|children|grandchildren|robert|susan|lily)\b/i.test(lower)) {
    const faces = ctx.familiarFaces.length ? ctx.familiarFaces.join(', ') : `${ctx.caregiverName} and Robert`;
    return `Your family means the world to you — ${faces}. They think about you every single day, ${ctx.firstName}.`;
  }

  if (/\b(food|eat|hungry|breakfast|lunch|dinner)\b/i.test(lower)) {
    const ate = ctx.completedToday.find((e) => /breakfast|lunch|dinner|meal|ate/i.test(e));
    if (ate) return `I remember ${ate.toLowerCase()}. Eating well keeps your energy up, ${ctx.firstName}.`;
    return `A warm meal sounds lovely, ${ctx.firstName}. ${ctx.caregiverName} often makes sure you're eating well.`;
  }

  if (/\b(sleep|tired|rest|nap)\b/i.test(lower)) {
    if (ctx.lastSleep) return `Last night you slept ${ctx.lastSleep}. Rest is so important, ${ctx.firstName}.`;
    return `Rest when you need to, ${ctx.firstName}. There's no hurry today.`;
  }

  // Follow-up on prior topic
  const lastAssistant = [...history].reverse().find((m) => m.role === 'assistant');
  if (lastAssistant && /\b(yes|yeah|okay|sure|please|tell me more)\b/i.test(lower)) {
    return `Of course, ${ctx.firstName}. ${ctx.recentActivity[0] ? `You had a nice day — ${ctx.recentActivity[0]}.` : `You're doing wonderfully today.`} What else would you like to talk about?`;
  }

  // Open conversation — anchor in today's activity
  if (ctx.recentActivity.length) {
    return `That's a lovely thought, ${ctx.firstName}. Earlier today ${ctx.recentActivity[0].toLowerCase()}. I'm enjoying our chat — tell me more.`;
  }

  return `I'm listening, ${ctx.firstName}. It's ${ctx.timeStr} and you're at home in ${ctx.city.split(',')[0]}. What's on your heart right now?`;
}
