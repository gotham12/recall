/**
 * Recall API — Cloudflare Worker
 * Primary LLM: Workers AI (Llama, no external API key)
 * Fallbacks: Groq / ElevenLabs / Google Vision when secrets are set
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
};

const CF_CHAT_MODELS = [
  '@cf/meta/llama-3.1-8b-instruct',
  '@cf/meta/llama-3-8b-instruct',
];

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);

    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      return json({
        ok: true,
        service: 'recall-api',
        llm: env.AI ? 'workers-ai' : 'groq-only',
        routes: ['/api/groq/chat', '/api/groq/vision', '/api/groq/transcribe', '/api/elevenlabs/tts', '/api/vision/annotate'],
      });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    try {
      if (url.pathname === '/api/groq/chat') {
        return await handleChat(body, env);
      }

      if (url.pathname === '/api/groq/vision') {
        return await handleGroqVision(body, env);
      }

      if (url.pathname === '/api/groq/transcribe') {
        return await handleGroqTranscribe(body, env);
      }

      if (url.pathname === '/api/elevenlabs/tts') {
        return await handleTts(body, env);
      }

      if (url.pathname === '/api/vision/annotate') {
        return await handleVisionAnnotate(body, env);
      }

      return json({ error: 'Not found' }, 404);
    } catch (err) {
      return json({ error: String(err) }, 500);
    }
  },
};

/** Clara / Groq-compatible chat — Workers AI first, Groq fallback */
async function handleChat(body, env) {
  const messages = body.messages;
  if (!Array.isArray(messages) || !messages.length) {
    return json({ error: 'messages array required' }, 400);
  }

  if (env.AI) {
    let lastErr;
    for (const model of CF_CHAT_MODELS) {
      try {
        const result = await env.AI.run(model, {
          messages,
          max_tokens: body.max_tokens ?? 320,
          temperature: body.temperature ?? 0.78,
        });
        const content = extractAIText(result);
        if (content) return json({ content, provider: 'workers-ai', model });
      } catch (err) {
        lastErr = err;
        console.error(`Workers AI ${model} failed:`, err);
      }
    }
    if (lastErr) console.error('All Workers AI models failed, trying Groq fallback');
  }

  requireSecret(env.GROQ_API_KEY, 'GROQ_API_KEY');
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) return json({ error: data }, res.status);
  return json({
    content: data.choices?.[0]?.message?.content?.trim() ?? '',
    provider: 'groq',
  });
}

async function handleGroqTranscribe(body, env) {
  requireSecret(env.GROQ_API_KEY, 'GROQ_API_KEY');
  if (!body.audio?.trim()) {
    return json({ error: 'audio (base64) required' }, 400);
  }

  const mimeType = body.mimeType || 'audio/webm';
  const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
  const bytes = base64ToBytes(body.audio);
  const formData = new FormData();
  formData.append('file', new Blob([bytes], { type: mimeType }), `audio.${ext}`);
  formData.append('model', body.model || 'whisper-large-v3-turbo');
  formData.append('language', body.language || 'en');
  formData.append('response_format', 'json');

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) return json({ error: data }, res.status);
  return json({ text: (data.text ?? '').trim() });
}

async function handleGroqVision(body, env) {
  requireSecret(env.GROQ_API_KEY, 'GROQ_API_KEY');
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) return json({ error: data }, res.status);
  return json({ content: data.choices?.[0]?.message?.content ?? '{}' });
}

async function handleTts(body, env) {
  // Workers AI MeloTTS when no ElevenLabs key
  if (env.AI && body.text?.trim()) {
    try {
      const result = await env.AI.run('@cf/myshell-ai/melotts', {
        prompt: body.text.trim(),
        lang: 'en',
      });
      const audio = result?.audio;
      if (audio) {
        const bytes = typeof audio === 'string' ? base64ToBytes(audio) : audio;
        if (bytes?.byteLength) {
          return new Response(bytes, {
            headers: { ...CORS, 'Content-Type': 'audio/mpeg' },
          });
        }
      }
    } catch (err) {
      console.error('Workers AI TTS failed:', err);
    }
  }

  requireSecret(env.ELEVENLABS_API_KEY, 'ELEVENLABS_API_KEY');
  const voiceId = body.voiceId || 'EXAVITQu4vr4xnSDxMaL';
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': env.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: body.text,
      model_id: body.model_id || 'eleven_turbo_v2_5',
      voice_settings: body.voice_settings,
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    return new Response(detail, { status: res.status, headers: CORS });
  }
  return new Response(await res.arrayBuffer(), {
    headers: { ...CORS, 'Content-Type': 'audio/mpeg' },
  });
}

async function handleVisionAnnotate(body, env) {
  requireSecret(env.GOOGLE_VISION_KEY, 'GOOGLE_VISION_KEY');
  const res = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${env.GOOGLE_VISION_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body.googleRequest),
    }
  );
  const data = await res.json();
  if (!res.ok) return json({ error: data }, res.status);
  return json(data);
}

function extractAIText(result) {
  if (!result) return '';
  if (typeof result === 'string') return result.trim();
  if (result.response) return String(result.response).trim();
  if (result.text) return String(result.text).trim();
  return '';
}

function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function requireSecret(value, name) {
  if (!value?.trim()) {
    throw new Error(`Worker secret ${name} is not configured`);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
