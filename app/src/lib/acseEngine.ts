/**
 * ACSE — Adaptive Cognitive Stability Engine
 *
 * Maps observable behavioral signals to a 0–100 stability score.
 * Each signal is grounded in dementia-care literature (perseveration,
 * sundowning, medication confusion, disengagement) — not a clinical diagnosis.
 */

export type AcseSignalId =
  | 'perseveration'
  | 'semantic_loop'
  | 'sundowning'
  | 'disorientation_speech'
  | 'rapid_navigation'
  | 'inactivity'
  | 'medication_confusion'
  | 'missed_medication'
  | 'recovery'
  | 'caregiver_warmth';

export interface AcseSignal {
  id: AcseSignalId;
  label: string;
  points: number;
  neurology: string;
  clinicalBasis: string;
}

export const ACSE_SIGNALS: Record<AcseSignalId, Omit<AcseSignal, 'points'>> = {
  perseveration: {
    id: 'perseveration',
    label: 'Perseveration',
    neurology: 'Prefrontal–hippocampal loop repetition',
    clinicalBasis:
      'Repeating the same question within minutes mirrors perseverative behavior seen in Alzheimer\'s (frontal lobe disinhibition + episodic memory gap).',
  },
  semantic_loop: {
    id: 'semantic_loop',
    label: 'Semantic loop',
    neurology: 'Topic-bound memory retrieval failure',
    clinicalBasis:
      'Paraphrased repeats (same topic, different words) suggest the patient cannot consolidate a new answer — a hallmark of short-term memory encoding failure.',
  },
  sundowning: {
    id: 'sundowning',
    label: 'Sundowning pattern',
    neurology: 'Circadian arousal dysregulation',
    clinicalBasis:
      'Late-afternoon confusion peaks when melatonin rises and cortisol falls — the classic sundowning window (4–8 PM) documented in dementia care guidelines.',
  },
  disorientation_speech: {
    id: 'disorientation_speech',
    label: 'Disorientation in speech',
    neurology: 'Temporal/spatial awareness decline',
    clinicalBasis:
      'Phrases like "where am I" or "what day" reflect impaired orientation — one of the first domains affected in mild cognitive impairment.',
  },
  rapid_navigation: {
    id: 'rapid_navigation',
    label: 'Erratic navigation',
    neurology: 'Executive function / goal-directed behavior breakdown',
    clinicalBasis:
      'Rapid, purposeless screen switching can indicate loss of task persistence — associated with executive dysfunction in vascular and Alzheimer\'s dementia.',
  },
  inactivity: {
    id: 'inactivity',
    label: 'Prolonged disengagement',
    neurology: 'Apathy / reduced initiation',
    clinicalBasis:
      'Extended silence during waking hours may reflect apathy syndrome — common in dementia and distinct from depression, linked to anterior cingulate hypoactivity.',
  },
  medication_confusion: {
    id: 'medication_confusion',
    label: 'Medication re-dosing attempt',
    neurology: 'Procedural memory vs. episodic gap',
    clinicalBasis:
      'Attempting to log a medication already taken suggests the patient cannot recall the prior action — a safety-critical episodic memory failure.',
  },
  missed_medication: {
    id: 'missed_medication',
    label: 'Missed medication window',
    neurology: 'Routine memory breakdown',
    clinicalBasis:
      'Missing scheduled doses disrupts cholinergic medication timing and correlates with increased agitation in Lewy body and Alzheimer\'s patients.',
  },
  recovery: {
    id: 'recovery',
    label: 'Engagement recovery',
    neurology: 'Cognitive reserve / compensatory engagement',
    clinicalBasis:
      'Sustained calm interaction can temporarily stabilize arousal — supported by reminiscence therapy and structured routine literature.',
  },
  caregiver_warmth: {
    id: 'caregiver_warmth',
    label: 'Caregiver warmth received',
    neurology: 'Social co-regulation',
    clinicalBasis:
      'Familiar caregiver presence reduces cortisol and agitation — the basis of validation therapy and attachment-based dementia care.',
  },
};

const CONFUSION_PATTERNS = [
  /\bwhere am i\b/i,
  /\bwhat day\b/i,
  /\bwhat time\b/i,
  /\bwho are you\b/i,
  /\bwhere is\b.*\b(my|the)\b/i,
  /\bi don'?t (know|remember)\b/i,
  /\bwhat did i\b/i,
  /\bhelp me\b/i,
  /\bi'?m lost\b/i,
  /\bcan'?t find\b/i,
];

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'what', 'who', 'where', 'when',
  'how', 'my', 'i', 'me', 'do', 'did', 'to', 'of', 'in', 'on', 'at', 'for',
  'and', 'or', 'it', 'that', 'this', 'today', 'please', 'tell',
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

export function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const w of setA) {
    if (setB.has(w)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function isSundowningWindow(): boolean {
  const hour = new Date().getHours();
  return hour >= 16 && hour <= 20;
}

export function detectDisorientation(text: string): boolean {
  return CONFUSION_PATTERNS.some((p) => p.test(text));
}

export function getSundowningMultiplier(): number {
  return isSundowningWindow() ? 1.5 : 1;
}

export interface AcseDeduction {
  signalId: AcseSignalId;
  points: number;
  reason: string;
  neurology: string;
}

export function buildDeduction(
  signalId: AcseSignalId,
  basePoints: number,
  reason: string,
  multiplier = 1
): AcseDeduction {
  const points = Math.round(basePoints * multiplier);
  return {
    signalId,
    points,
    reason,
    neurology: ACSE_SIGNALS[signalId].neurology,
  };
}
