import { OPENROUTER_API_KEY } from '../env';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

/** Fast, high-quality model for Clara conversations */
const CLARA_MODEL_PRIMARY = 'anthropic/claude-3-haiku';
/** Fallback within OpenRouter */
const CLARA_MODEL_FALLBACK = 'meta-llama/llama-3.3-70b-instruct';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterOptions {
  model?: string;
  max_tokens?: number;
  temperature?: number;
}

async function openRouterChat(messages: Message[], opts: OpenRouterOptions = {}): Promise<string> {
  const key = OPENROUTER_API_KEY?.trim();
  if (!key) throw new Error('No OpenRouter API key configured');

  const model = opts.model ?? CLARA_MODEL_PRIMARY;
  const max_tokens = opts.max_tokens ?? 320;
  const temperature = opts.temperature ?? 0.78;

  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://recall-app.io',
      'X-Title': 'Recall — Clara Companion',
    },
    body: JSON.stringify({ model, messages, max_tokens, temperature }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`OpenRouter ${res.status}${err ? `: ${err.slice(0, 120)}` : ''}`);
  }

  const data = await res.json();
  const text: string = data.choices?.[0]?.message?.content?.trim() ?? '';
  if (!text) throw new Error('OpenRouter returned empty response');
  return text;
}

/** Chat via OpenRouter with automatic model fallback (Claude Haiku → Llama 3.3 70B). */
export async function openRouterClaraChat(messages: Message[]): Promise<string> {
  try {
    return await openRouterChat(messages, { model: CLARA_MODEL_PRIMARY });
  } catch (primaryErr) {
    console.warn('[OpenRouter] Primary model failed, trying fallback:', primaryErr);
    return await openRouterChat(messages, { model: CLARA_MODEL_FALLBACK, max_tokens: 280 });
  }
}
