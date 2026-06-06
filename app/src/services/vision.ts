import { GOOGLE_VISION_KEY, GROQ_API_KEY } from '../env';

export interface VisionResult {
  detected: boolean;
  confidence: 'high' | 'medium' | 'low';
  description: string;
  source: 'google' | 'groq' | 'manual';
}

export async function verifyMedication(
  base64Image: string,
  medicationName: string
): Promise<VisionResult> {
  try {
    return await verifyWithGoogle(base64Image, medicationName);
  } catch (googleErr) {
    console.warn('Google Vision failed, trying Groq Vision:', googleErr);
    try {
      return await verifyWithGroq(base64Image, medicationName);
    } catch (groqErr) {
      console.warn('Groq Vision failed too:', groqErr);
      return {
        detected: false,
        confidence: 'low',
        description: 'Vision service unavailable. Manual confirmation required.',
        source: 'manual',
      };
    }
  }
}

async function verifyWithGoogle(
  base64Image: string,
  medicationName: string
): Promise<VisionResult> {
  const body = {
    requests: [
      {
        image: { content: base64Image },
        features: [
          { type: 'LABEL_DETECTION', maxResults: 10 },
          { type: 'OBJECT_LOCALIZATION', maxResults: 10 },
        ],
      },
    ],
  };

  const res = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) throw new Error(`Google Vision ${res.status}`);
  const data = await res.json();

  const labels: string[] = (data.responses?.[0]?.labelAnnotations ?? []).map(
    (l: { description: string }) => l.description.toLowerCase()
  );
  const objects: string[] = (
    data.responses?.[0]?.localizedObjectAnnotations ?? []
  ).map((o: { name: string }) => o.name.toLowerCase());

  const medKeywords = ['pill', 'tablet', 'capsule', 'medication', 'medicine', 'drug', 'bottle', 'pharmaceutical', 'prescription'];
  const allDetected = [...labels, ...objects];

  const hits = medKeywords.filter((kw) =>
    allDetected.some((label) => label.includes(kw))
  );

  if (hits.length >= 2) {
    return {
      detected: true,
      confidence: 'high',
      description: `Detected medication-related items: ${allDetected.slice(0, 3).join(', ')}.`,
      source: 'google',
    };
  } else if (hits.length === 1) {
    return {
      detected: true,
      confidence: 'medium',
      description: `Possible medication detected: ${allDetected.slice(0, 3).join(', ')}.`,
      source: 'google',
    };
  } else {
    return {
      detected: false,
      confidence: 'low',
      description: `No medication clearly visible. Detected: ${allDetected.slice(0, 3).join(', ') || 'nothing clear'}.`,
      source: 'google',
    };
  }
}

async function verifyWithGroq(
  base64Image: string,
  medicationName: string
): Promise<VisionResult> {
  const prompt = `The user is supposed to take ${medicationName}. Does this image show a pill bottle, pill, or medication packaging? Reply with JSON only: { "detected": true/false, "confidence": "high"/"medium"/"low", "description": "brief description" }`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.2-11b-vision-preview',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${base64Image}` },
            },
          ],
        },
      ],
      max_tokens: 150,
      temperature: 0,
    }),
  });

  if (!res.ok) throw new Error(`Groq Vision ${res.status}`);
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? '{}';

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] ?? '{}');
    return {
      detected: !!parsed.detected,
      confidence: parsed.confidence ?? 'low',
      description: parsed.description ?? 'Vision analysis complete.',
      source: 'groq',
    };
  } catch {
    return { detected: false, confidence: 'low', description: raw, source: 'groq' };
  }
}
