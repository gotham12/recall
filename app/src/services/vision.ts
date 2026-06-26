import { GOOGLE_VISION_KEY, GROQ_API_KEY } from '../env';
import { proxyPost, usesApiProxy, warnDirectApiKeys } from './apiClient';
import {
  countMedicationSignals,
  medicationMatchesVision,
  medicationVisionKeywords,
} from '../lib/medicationVision';

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

async function verifyWithGoogle(
  base64Image: string,
  medicationName: string
): Promise<VisionResult> {
  const googleRequest = {
    requests: [
      {
        image: { content: base64Image },
        features: [
          { type: 'LABEL_DETECTION', maxResults: 20 },
          { type: 'OBJECT_LOCALIZATION', maxResults: 10 },
          { type: 'TEXT_DETECTION', maxResults: 10 },
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
    try {
      data = await proxyPost('/api/vision/annotate', { googleRequest });
    } catch (err) {
      console.warn('Vision proxy failed, trying direct API:', err);
      if (!GOOGLE_VISION_KEY?.trim()) throw err;
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
  const ocrText = (data.responses?.[0]?.textAnnotations?.[0]?.description ?? '').toLowerCase();
  const textChunks = ocrText ? [ocrText, ...ocrText.split(/\s+/)] : [];

  const allDetected = [...labels, ...objects, ...textChunks];
  const medSignals = countMedicationSignals(allDetected);
  const nameMatch = medicationMatchesVision(medicationName, allDetected);
  const ocrSnippet = ocrText.slice(0, 80).replace(/\s+/g, ' ').trim();

  if (nameMatch && medSignals >= 1) {
    return {
      detected: true,
      confidence: medSignals >= 2 || ocrText.includes('tylenol') ? 'high' : 'medium',
      description: `Confirmed ${medicationName}${ocrSnippet ? ` — label reads "${ocrSnippet}"` : ''}.`,
      source: 'google',
    };
  }

  if (nameMatch) {
    return {
      detected: true,
      confidence: 'medium',
      description: `Likely ${medicationName} — packaging text matched.`,
      source: 'google',
    };
  }

  if (medSignals >= 2) {
    return {
      detected: false,
      confidence: 'low',
      description: `Found medication packaging but could not confirm ${medicationName}.${ocrSnippet ? ` Saw: "${ocrSnippet}"` : ''}`,
      source: 'google',
    };
  }

  return {
    detected: false,
    confidence: 'low',
    description: `No ${medicationName} clearly visible.${ocrSnippet ? ` Detected text: "${ocrSnippet}"` : ''}`,
    source: 'google',
  };
}

async function verifyWithGroq(
  base64Image: string,
  medicationName: string
): Promise<VisionResult> {
  const aliases = medicationVisionKeywords(medicationName).slice(0, 8).join(', ');
  const prompt = `You are verifying medication for a dementia care app.
The patient must take: "${medicationName}".
Also accept these label terms as a match: ${aliases}.

Look for the medication bottle, box, or blister pack in the image. For Tylenol, expect a white bottle with a red TYLENOL label and "Acetaminophen" / "Extra Strength" text.

Reply with JSON only:
{ "detected": true or false, "confidence": "high" or "medium" or "low", "description": "brief reason" }`;

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
    try {
      const data = await proxyPost<{ content: string }>('/api/groq/vision', payload);
      raw = data.content;
    } catch (err) {
      console.warn('Groq vision proxy failed, trying direct API:', err);
      if (!GROQ_API_KEY?.trim()) throw err;
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
    const detected = !!parsed.detected;
    const confidence = (parsed.confidence ?? 'low') as VisionResult['confidence'];

    if (detected && confidence === 'low') {
      return {
        detected: true,
        confidence: 'medium',
        description: parsed.description ?? 'Vision model matched medication.',
        source: 'groq',
      };
    }

    return {
      detected,
      confidence,
      description: parsed.description ?? 'Vision analysis complete.',
      source: 'groq',
    };
  } catch {
    return { detected: false, confidence: 'low', description: raw, source: 'groq' };
  }
}
