/**
 * Cloudflare Worker proxy — keeps API keys off the client.
 * Deploy: wrangler deploy
 * Set secrets: GROQ_API_KEY, ELEVENLABS_API_KEY, GOOGLE_VISION_KEY
 * Then set VITE_API_BASE_URL to your worker URL in GitHub Actions / .env
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: CORS });
    }

    const url = new URL(request.url);
    const body = await request.json();

    try {
      if (url.pathname === '/api/groq/chat') {
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
            model_id: body.model_id || 'eleven_flash_v2_5',
            voice_settings: body.voice_settings,
          }),
        });
        if (!res.ok) return new Response(await res.text(), { status: res.status, headers: CORS });
        return new Response(await res.arrayBuffer(), {
          headers: { ...CORS, 'Content-Type': 'audio/mpeg' },
        });
      }

      if (url.pathname === '/api/vision/annotate') {
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

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
