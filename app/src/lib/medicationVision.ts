import type { Medication } from '../db/db';

/** Demo medication — physical Tylenol bottle shown to camera */
export const DEMO_TYLENOL: Medication = {
  name: 'Tylenol Extra Strength',
  dosage: '500mg (2 caplets)',
  schedule: ['9:00 AM', '1:00 PM', '6:00 PM'],
};

/** OCR / vision aliases — brand → tokens that may appear on packaging */
export const MEDICATION_VISION_ALIASES: Record<string, string[]> = {
  tylenol: [
    'tylenol',
    'acetaminophen',
    'paracetamol',
    'extra strength',
    'pain reliever',
    'fever reducer',
    'caplets',
    'caplet',
    'mcneil',
    'johnson',
  ],
  donepezil: ['donepezil', 'aricept'],
  memantine: ['memantine', 'namenda'],
  levodopa: ['levodopa', 'carbidopa', 'sinemet'],
};

const MED_KEYWORDS = [
  'pill', 'tablet', 'capsule', 'caplet', 'medication', 'medicine', 'drug',
  'bottle', 'pharmaceutical', 'prescription', 'blister', 'packaging', 'label',
];

export function medicationVisionKeywords(medicationName: string): string[] {
  const norm = medicationName.toLowerCase();
  const aliases = new Set<string>();

  for (const [key, values] of Object.entries(MEDICATION_VISION_ALIASES)) {
    if (norm.includes(key) || key.includes(norm.split(/\s+/)[0] ?? '')) {
      values.forEach((v) => aliases.add(v));
    }
  }

  norm.split(/[\s/()-]+/).filter((t) => t.length > 2).forEach((t) => aliases.add(t));

  return [...aliases];
}

export function medicationMatchesVision(medicationName: string, detected: string[]): boolean {
  const haystack = detected.join(' ').toLowerCase();
  if (!haystack.trim()) return false;

  const keywords = medicationVisionKeywords(medicationName);
  const aliasHit = keywords.some((kw) => haystack.includes(kw));
  if (aliasHit) return true;

  const norm = medicationName.toLowerCase();
  return norm.split(/[\s/-]+/).filter((t) => t.length > 3).some((t) => haystack.includes(t));
}

export function countMedicationSignals(detected: string[]): number {
  const haystack = detected.join(' ').toLowerCase();
  return MED_KEYWORDS.filter((kw) => haystack.includes(kw)).length;
}

export function isTylenolMed(name: string): boolean {
  return name.toLowerCase().includes('tylenol');
}
