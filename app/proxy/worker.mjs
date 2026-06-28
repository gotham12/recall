/**
 * Recall API — Cloudflare Worker
 * Primary LLM: Workers AI (Llama, no external API key)
 * Fallbacks: Gemini / Groq / ElevenLabs / Google Vision when secrets are set
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
const CF_VISION_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';
const CF_VISION_FALLBACK_MODEL = '@cf/llava-hf/llava-1.5-7b-hf';

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
        routes: ['/api/workers-ai/vision', '/api/gemini/vision', '/api/groq/chat', '/api/groq/vision', '/api/groq/transcribe', '/api/elevenlabs/tts', '/api/vision/annotate'],
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
      if (url.pathname === '/api/workers-ai/vision') {
        return await handleWorkersAiVision(body, env);
      }

      if (url.pathname === '/api/gemini/vision') {
        return await handleGeminiVision(body, env);
      }

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

async function handleWorkersAiVision(body, env) {
  if (!env.AI) {
    return json({ error: 'Workers AI binding is not configured' }, 503);
  }
  if (!body.image?.trim() || !body.prompt?.trim()) {
    return json({ error: 'image and prompt are required' }, 400);
  }

  const image = body.image.startsWith('data:')
    ? body.image
    : `data:${body.mimeType || 'image/jpeg'};base64,${body.image}`;
  let response;
  let model = CF_VISION_MODEL;
  try {
    response = await env.AI.run(CF_VISION_MODEL, {
      messages: [
        { role: 'system', content: 'You verify medication labels from camera images. Reply only with valid JSON.' },
        { role: 'user', content: body.prompt },
      ],
      image,
      max_tokens: body.max_tokens ?? 160,
      temperature: body.temperature ?? 0,
    });
  } catch (err) {
    const message = String(err);
    if (!message.includes('5016') && !message.toLowerCase().includes('agree')) {
      throw err;
    }
    const bytes = base64ToBytes(image.replace(/^data:[^,]+,/, ''));
    model = CF_VISION_FALLBACK_MODEL;
    response = await env.AI.run(CF_VISION_FALLBACK_MODEL, {
      prompt: body.prompt,
      image: [...new Uint8Array(bytes)],
      max_tokens: body.max_tokens ?? 160,
      temperature: body.temperature ?? 0,
    });
  }

  return json({
    content: extractAIText(response) || response?.response || response?.description || JSON.stringify(response ?? {}),
    provider: 'workers-ai',
    model,
  });
}

async function handleGeminiVision(body, env) {
  requireSecret(env.GEMINI_API_KEY, 'GEMINI_API_KEY');
  const model = body.model || 'gemini-2.0-flash';
  const { model: _model, ...geminiBody } = body;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    }
  );
  const data = await res.json();
  if (!res.ok) return json({ error: data }, res.status);
  return json({ content: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}' });
}

/** Clara / Groq-compatible chat — Workers AI first, Groq fallback */
async function handleChat(body, env) {
  const messages = body.messages;
  if (!Array.isArray(messages) || !messages.length) {
    return json({ error: 'messages array required' }, 400);
  }

  // Groq 70B first — Workers AI 8B is faster but noticeably weaker for Clara
  if (env.GROQ_API_KEY?.trim()) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        const content = data.choices?.[0]?.message?.content?.trim() ?? '';
        if (content) return json({ content, provider: 'groq' });
      }
      console.error('Groq chat failed:', res.status, JSON.stringify(data).slice(0, 200));
    } catch (err) {
      console.error('Groq chat error:', err);
    }
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
    if (lastErr) console.error('All Workers AI models failed');
  }

  return json({ error: 'Chat not configured — set GROQ_API_KEY or Workers AI binding' }, 503);
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
  const hasElevenLabs = Boolean(env.ELEVENLABS_API_KEY?.trim());

  if (hasElevenLabs) {
    try {
      return await elevenLabsTts(body, env);
    } catch (err) {
      console.error('ElevenLabs TTS failed, falling back to Workers AI MeloTTS:', err);
    }
  }

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
            headers: { ...CORS, 'Content-Type': 'audio/wav', 'X-TTS-Provider': 'melotts' },
          });
        }
      }
    } catch (err) {
      console.error('Workers AI TTS failed:', err);
    }
  }

  return json({ error: 'TTS not configured — set ELEVENLABS_API_KEY on worker' }, 503);
}

async function elevenLabsTts(body, env) {
  const voiceId = body.voiceId || 'cgSgspJ2msm6clMCkdW9';
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
      voice_settings: body.voice_settings ?? {
        stability: 0.35,
        similarity_boost: 0.9,
        style: 0.68,
        use_speaker_boost: true,
        speed: 1.02,
      },
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`ElevenLabs ${res.status}: ${detail.slice(0, 120)}`);
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
