import type { FamiliarFace, User } from '../db/db';
import { LOGIN_HERO } from './assets';
import { memoryPhotoUrl } from './memoryPhotos';

export interface MemorySlide {
  id: string;
  photoUrl: string;
  caption: string;
  speakText: string;
  person?: string;
}

const LONELINESS_PATTERNS = [
  /\b(lonely|loneliness|alone|by myself|no one here|nobody here)\b/i,
  /\b(i miss (you|them|her|him|everyone|my family))\b/i,
  /\b(where is (everyone|my family|susan|robert))\b/i,
  /\b(i wish (you|someone|they) (were|was) here)\b/i,
  /\b(no one (visits|calls|comes))\b/i,
  /\b(feel(ing)? (so )?alone)\b/i,
  /\b(company|someone to talk)\b/i,
];

/** Demo album — Margaret's family in cherished moments */
const MARGARET_MEMORY_ALBUM: Omit<MemorySlide, 'id'>[] = [
  {
    photoUrl: memoryPhotoUrl('garden'),
    caption: 'Your family together in the garden — everyone smiling.',
    speakText: 'Oh, Margaret… look at your beautiful family in the garden. Everyone is gathered close, and you are right at the heart of it all. You are so loved.',
    person: 'Family',
  },
  {
    photoUrl: memoryPhotoUrl('dinner'),
    caption: 'Sunday dinner with Susan and Robert — everyone laughing.',
    speakText: 'Oh, what a lovely Sunday dinner. Susan and Robert were laughing, and you lit up the whole room with your stories. So much love at that table.',
    person: 'Family',
  },
  {
    photoUrl: memoryPhotoUrl('porch'),
    caption: 'A quiet afternoon on the porch at Maple Lane.',
    speakText: 'Remember sitting on the porch at Maple Lane on warm afternoons? The birds, the breeze, and the feeling of being safe and at home.',
    person: 'Margaret',
  },
  {
    photoUrl: memoryPhotoUrl('picnic'),
    caption: 'A family picnic at Lake Quinsigamond — a perfect summer day.',
    speakText: 'The picnic at the lake was pure joy. Everyone was together, and the air smelled like summer. Your heart was so full that day.',
    person: 'Family',
  },
  {
    photoUrl: memoryPhotoUrl('birthday'),
    caption: 'Your 75th birthday — Susan and Robert surprised you.',
    speakText: 'On your seventy-fifth birthday, Susan and Robert surprised you with so much love. The cake, the candles, the hugs — you are deeply cherished.',
    person: 'Family',
  },
];

function isLocalAsset(url: string): boolean {
  return !url.startsWith('http://') && !url.startsWith('https://');
}

function canonicalPhotoKey(url: string): string {
  if (isLocalAsset(url)) {
    return url.split('?')[0].split('#')[0];
  }
  const match = url.match(/photo-([a-z0-9-]+)/i);
  if (match) return match[1];
  return url.split('?')[0];
}

export function normalizePhotoUrl(url: string): string {
  if (isLocalAsset(url)) return url.split('?')[0];
  let u = url.replace('w=400', 'w=800').replace('h=400', 'h=600').replace('w=200', 'w=800').replace('h=200', 'h=600');
  if (!u.includes('auto=format')) {
    u += u.includes('?') ? '&auto=format' : '?auto=format';
  }
  return u;
}

export function detectLoneliness(text: string): boolean {
  return LONELINESS_PATTERNS.some((p) => p.test(text));
}

export function buildMemorySlides(user: User, familiarFaces: FamiliarFace[] = []): MemorySlide[] {
  const slides: MemorySlide[] = [];
  const seen = new Set<string>();

  const heroPhoto = user.familyPhotoUrl
    ? normalizePhotoUrl(user.familyPhotoUrl)
    : LOGIN_HERO.margaretProfile;

  const pushSlide = (slide: MemorySlide) => {
    const key = canonicalPhotoKey(slide.photoUrl);
    if (seen.has(key)) return;
    seen.add(key);
    slides.push(slide);
  };

  pushSlide({
    id: 'family-hero',
    photoUrl: heroPhoto,
    caption: 'A cherished moment with your family.',
    speakText: `Oh, ${user.name.split(' ')[0]}… look at this beautiful moment with your family. They adore you, and you are never truly alone.`,
    person: 'Family',
  });

  const album =
    user.name === 'Margaret' || user.name.toLowerCase().includes('margaret')
      ? MARGARET_MEMORY_ALBUM
      : MARGARET_MEMORY_ALBUM;

  album.forEach((s, i) => {
    pushSlide({ ...s, id: `album-${i}` });
  });

  familiarFaces.forEach((face, i) => {
    if (!face.photoUrl?.trim()) return;
    pushSlide({
      id: `face-${face.id ?? i}`,
      photoUrl: normalizePhotoUrl(face.photoUrl),
      caption: `${face.name}, your ${face.relationship.toLowerCase()}.`,
      speakText: face.memoryPrompt,
      person: face.name,
    });
  });

  return shuffleSlides(slides);
}

export function shuffleSlides(slides: MemorySlide[]): MemorySlide[] {
  const copy = [...slides];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
