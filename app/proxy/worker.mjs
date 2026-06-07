/**
 * Cloudflare Worker proxy — keeps API keys off the client.
 * Deploy: npm run deploy (in proxy/)
 * Secrets: GROQ_API_KEY, ELEVENLABS_API_KEY, GOOGLE_VISION_KEY
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
};

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
        routes: ['/api/groq/chat', '/api/groq/vision', '/api/elevenlabs/tts', '/api/vision/annotate'],
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
        });
      }

      if (url.pathname === '/api/groq/vision') {
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

      if (url.pathname === '/api/elevenlabs/tts') {
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

      if (url.pathname === '/api/vision/annotate') {
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

      return json({ error: 'Not found' }, 404);
    } catch (err) {
      return json({ error: String(err) }, 500);
    }
  },
};

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
