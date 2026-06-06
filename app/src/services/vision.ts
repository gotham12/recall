const VISION_KEY = import.meta.env.VITE_GOOGLE_VISION_KEY as string;
const GROQ_KEY   = import.meta.env.VITE_GROQ_API_KEY as string;

export interface VisionResult {
  detected: boolean;
  confidence: 'high' | 'medium' | 'low';
  description: string;
  source: 'google' | 'groq' | 'manual';
}

export async function verifyMedication(base64: string, medName: string): Promise<VisionResult> {
  try { return await googleVision(base64, medName); }
  catch (e) {
    console.warn('Google Vision failed, trying Groq:', e);
    try { return await groqVision(base64, medName); }
    catch (e2) {
      console.warn('Groq Vision failed:', e2);
      return { detected: false, confidence: 'low', description: 'Vision unavailable. Manual confirmation required.', source: 'manual' };
    }
  }
}

async function googleVision(base64: string, medName: string): Promise<VisionResult> {
  const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${VISION_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ image: { content: base64 }, features: [{ type: 'LABEL_DETECTION', maxResults: 15 }, { type: 'OBJECT_LOCALIZATION', maxResults: 10 }] }] }),
  });
  if (!res.ok) throw new Error(`Google Vision ${res.status}`);
  const data = await res.json();
  const labels: string[] = (data.responses?.[0]?.labelAnnotations ?? []).map((l: { description: string }) => l.description.toLowerCase());
  const objects: string[] = (data.responses?.[0]?.localizedObjectAnnotations ?? []).map((o: { name: string }) => o.name.toLowerCase());
  const all = [...labels, ...objects];
  const medKw = ['pill', 'tablet', 'capsule', 'medication', 'medicine', 'drug', 'bottle', 'pharmaceutical', 'prescription', medName.toLowerCase()];
  const hits = all.filter(l => medKw.some(k => l.includes(k)));

  if (hits.length >= 3) return { detected: true, confidence: 'high', description: `Detected: ${hits.slice(0, 3).join(', ')}`, source: 'google' };
  if (hits.length >= 1) return { detected: true, confidence: 'medium', description: `Possibly detected: ${hits.join(', ')}`, source: 'google' };
  return { detected: false, confidence: 'low', description: `Labels found: ${all.slice(0, 4).join(', ') || 'none'}`, source: 'google' };
}

async function groqVision(base64: string, medName: string): Promise<VisionResult> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.2-11b-vision-preview',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: `The user should take ${medName}. Does this image show a pill, tablet, capsule, pill bottle, or medication packaging? Reply with ONLY valid JSON: {"detected":true/false,"confidence":"high"/"medium"/"low","description":"brief description"}` },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
        ],
      }],
      max_tokens: 100,
    }),
  });
  if (!res.ok) throw new Error(`Groq Vision ${res.status}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(text.replace(/```json?|```/g, '').trim());
  return { ...parsed, source: 'groq' };
}
