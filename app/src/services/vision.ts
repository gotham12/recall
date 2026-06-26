import { GEMINI_API_KEY, GOOGLE_VISION_KEY, GROQ_API_KEY } from '../env';
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
  source: 'workers-ai' | 'gemini' | 'google' | 'groq' | 'manual';
}

export async function verifyMedication(
  base64Image: string,
  medicationName: string
): Promise<VisionResult> {
  try {
    const workersAiResult = await verifyWithWorkersAI(base64Image, medicationName);
    if (workersAiResult.detected && workersAiResult.confidence !== 'low') {
      return workersAiResult;
    }
  } catch (workersAiErr) {
    console.warn('Workers AI Vision failed, trying Gemini:', workersAiErr);
  }

  try {
    const geminiResult = await verifyWithGemini(base64Image, medicationName);
    if (geminiResult.detected && geminiResult.confidence !== 'low') {
      return geminiResult;
    }
  } catch (geminiErr) {
    console.warn('Gemini Vision failed, trying Groq:', geminiErr);
  }

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

function medicationVerificationPrompt(medicationName: string, aliasLimit = 10): string {
  const aliases = medicationVisionKeywords(medicationName).slice(0, aliasLimit).join(', ');
  return `You are verifying medication for a dementia care app.
The patient must take: "${medicationName}".
Also accept these label terms as a match: ${aliases}.

Inspect the image for a medication bottle, box, or blister pack. For Tylenol, expect a white bottle with a red TYLENOL label and "Acetaminophen" / "Extra Strength" text. Do not confirm if another medication is shown or the label is unreadable.

Reply with JSON only:
{ "detected": true or false, "confidence": "high" or "medium" or "low", "description": "brief reason" }`;
}

async function verifyWithWorkersAI(
  base64Image: string,
  medicationName: string
): Promise<VisionResult> {
  if (!usesApiProxy()) {
    throw new Error('Workers AI vision requires the API proxy');
  }

  const data = await proxyPost<{ content: string }>('/api/workers-ai/vision', {
    prompt: medicationVerificationPrompt(medicationName),
    image: base64Image,
    mimeType: 'image/jpeg',
    max_tokens: 160,
    temperature: 0,
  });
  return parseVisionJson(data.content, 'workers-ai');
}

async function verifyWithGemini(
  base64Image: string,
  medicationName: string
): Promise<VisionResult> {
  const prompt = medicationVerificationPrompt(medicationName);

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: 'image/jpeg',
              data: base64Image,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 160,
      responseMimeType: 'application/json',
    },
  };

  let raw: string;

  if (usesApiProxy()) {
    try {
      const data = await proxyPost<{ content: string }>('/api/gemini/vision', payload);
      raw = data.content;
    } catch (err) {
      console.warn('Gemini vision proxy failed, trying direct API:', err);
      if (!GEMINI_API_KEY?.trim()) throw err;
      warnDirectApiKeys();
      raw = await callGeminiDirect(payload);
    }
  } else {
    warnDirectApiKeys();
    raw = await callGeminiDirect(payload);
  }

  return parseVisionJson(raw, 'gemini');
}

async function callGeminiDirect(payload: unknown): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) throw new Error(`Gemini Vision ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
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

  return parseVisionJson(raw, 'groq');
}

function parseVisionJson(raw: string, source: 'workers-ai' | 'gemini' | 'groq'): VisionResult {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] ?? '{}');
    const detected = !!parsed.detected;
    const confidence =
      parsed.confidence === 'high' || parsed.confidence === 'medium' || parsed.confidence === 'low'
        ? parsed.confidence
        : 'low';

    return {
      detected,
      confidence,
      description: parsed.description ?? 'Vision analysis complete.',
      source,
    };
  } catch {
    return { detected: false, confidence: 'low', description: raw, source };
  }
}
