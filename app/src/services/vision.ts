import { GOOGLE_VISION_KEY, GROQ_API_KEY } from '../env';
import { proxyPost, usesApiProxy, warnDirectApiKeys } from './apiClient';

export interface VisionResult {
  detected: boolean;
  confidence: 'high' | 'medium' | 'low';
  description: string;
  source: 'google' | 'groq' | 'manual';
}

const MED_KEYWORDS = [
  'pill', 'tablet', 'capsule', 'medication', 'medicine', 'drug',
  'bottle', 'pharmaceutical', 'prescription', 'blister',
];

export async function verifyMedication(
  base64Image: string,
  medicationName: string
): Promise<VisionResult> {
  try {
    const groqResult = await verifyWithGroq(base64Image, medicationName);
    if (groqResult.detected && groqResult.confidence !== 'low') {
      return groqResult;
    }
  } catch (groqErr) {
    console.warn('Groq Vision failed, trying Google:', groqErr);
  }

  try {
    return await verifyWithGoogle(base64Image, medicationName);
  } catch (googleErr) {
    console.warn('Google Vision failed:', googleErr);
    return {
      detected: false,
      confidence: 'low',
      description: 'Vision service unavailable. Manual confirmation required.',
      source: 'manual',
    };
  }
}

function medicationNameInLabels(medicationName: string, labels: string[]): boolean {
  const normalized = medicationName.toLowerCase();
  const tokens = normalized.split(/[\s/-]+/).filter((t) => t.length > 3);
  return labels.some((label) =>
    tokens.some((token) => label.includes(token)) || label.includes(normalized)
  );
}

async function verifyWithGoogle(
  base64Image: string,
  medicationName: string
): Promise<VisionResult> {
  const googleRequest = {
    requests: [
      {
        image: { content: base64Image },
        features: [
          { type: 'LABEL_DETECTION', maxResults: 15 },
          { type: 'OBJECT_LOCALIZATION', maxResults: 10 },
          { type: 'TEXT_DETECTION', maxResults: 5 },
        ],
      },
    ],
  };

  let data: {
    responses?: Array<{
      labelAnnotations?: Array<{ description: string }>;
      localizedObjectAnnotations?: Array<{ name: string }>;
      textAnnotations?: Array<{ description: string }>;
    }>;
  };

  if (usesApiProxy()) {
    data = await proxyPost('/api/vision/annotate', { googleRequest });
  } else {
    warnDirectApiKeys();
    const res = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(googleRequest),
      }
    );
    if (!res.ok) throw new Error(`Google Vision ${res.status}`);
    data = await res.json();
  }

  const labels: string[] = (data.responses?.[0]?.labelAnnotations ?? []).map(
    (l) => l.description.toLowerCase()
  );
  const objects: string[] = (data.responses?.[0]?.localizedObjectAnnotations ?? []).map(
    (o) => o.name.toLowerCase()
  );
  const text: string[] = (data.responses?.[0]?.textAnnotations ?? []).map(
    (t) => t.description.toLowerCase()
  );

  const allDetected = [...labels, ...objects, ...text];
  const hits = MED_KEYWORDS.filter((kw) => allDetected.some((label) => label.includes(kw)));
  const nameMatch = medicationNameInLabels(medicationName, allDetected);

  if (hits.length >= 2 && nameMatch) {
    return {
      detected: true,
      confidence: 'high',
      description: `Confirmed ${medicationName} in view.`,
      source: 'google',
    };
  }

  if (hits.length >= 1 && nameMatch) {
    return {
      detected: true,
      confidence: 'medium',
      description: `Likely ${medicationName}: ${allDetected.slice(0, 3).join(', ')}.`,
      source: 'google',
    };
  }

  if (hits.length >= 1) {
    return {
      detected: false,
      confidence: 'low',
      description: `Found medication-like items but could not confirm ${medicationName}.`,
      source: 'google',
    };
  }

  return {
    detected: false,
    confidence: 'low',
    description: `No ${medicationName} clearly visible. Detected: ${allDetected.slice(0, 3).join(', ') || 'nothing clear'}.`,
    source: 'google',
  };
}

async function verifyWithGroq(
  base64Image: string,
  medicationName: string
): Promise<VisionResult> {
  const prompt = `The patient must take "${medicationName}" right now. Study the image carefully.
Does it show the correct medication (pill, bottle, blister pack, or packaging) that matches "${medicationName}"?
Reply with JSON only: { "detected": true/false, "confidence": "high"/"medium"/"low", "description": "brief reason mentioning ${medicationName}" }`;

  const payload = {
    model: 'llama-3.2-11b-vision-preview',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
        ],
      },
    ],
    max_tokens: 150,
    temperature: 0,
  };

  let raw: string;

  if (usesApiProxy()) {
    const data = await proxyPost<{ content: string }>('/api/groq/vision', payload);
    raw = data.content;
  } else {
    warnDirectApiKeys();
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Groq Vision ${res.status}`);
    const data = await res.json();
    raw = data.choices?.[0]?.message?.content ?? '{}';
  }

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
