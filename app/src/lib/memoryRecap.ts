import type { FamiliarFace, User } from '../db/db';

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

/** Demo album — same family as Margaret's profile, different cherished moments */
const MARGARET_MEMORY_ALBUM: Omit<MemorySlide, 'id'>[] = [
  {
    photoUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=800&h=600&fit=crop&auto=format',
    caption: 'You on the porch at Maple Lane — your favorite sunny spot.',
    speakText: 'Oh, Margaret… look at you on the porch at Maple Lane. The sun feels so warm, and Lily is right beside you. You are loved.',
    person: 'Margaret',
  },
  {
    photoUrl: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=800&h=600&fit=crop&auto=format',
    caption: 'Sunday dinner with Susan and Robert — everyone laughing.',
    speakText: 'Oh, what a lovely Sunday dinner… Susan and Robert were laughing, and you lit up the whole room with your stories. So much love at that table.',
    person: 'Family',
  },
  {
    photoUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=800&h=600&fit=crop&auto=format',
    caption: "Susan's visit — she brought blueberry pie, just how you like it.",
    speakText: 'This is your darling Susan. She visits you and calls every single day because she loves you more than words can say.',
    person: 'Susan',
  },
  {
    photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&h=600&fit=crop&auto=format',
    caption: 'Robert teaching you chess on the back porch.',
    speakText: 'And here is Robert, your sweet grandson. He adores playing chess with you — and he still says you always win.',
    person: 'Robert',
  },
  {
    photoUrl: 'https://images.unsplash.com/photo-1464226184743-18fb080fad2d?w=800&h=600&fit=crop&auto=format',
    caption: 'Your garden in full bloom — Susan helped you plant the roses.',
    speakText: 'Your garden was breathtaking that spring. Susan helped you plant every rose, and she was so proud of you.',
    person: 'Margaret & Susan',
  },
  {
    photoUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&h=600&fit=crop&auto=format',
    caption: 'A family picnic at Lake Quinsigamond — a perfect summer day.',
    speakText: 'The picnic at the lake was pure joy. Everyone was together, and your heart was so full of happiness.',
    person: 'Family',
  },
  {
    photoUrl: 'https://images.unsplash.com/photo-1533777857889-8be897c693ab?w=800&h=600&fit=crop&auto=format',
    caption: 'Your 75th birthday — Susan and Robert surprised you.',
    speakText: 'On your seventy-fifth birthday, Susan and Robert surprised you with so much love. The cake, the hugs — you are cherished.',
    person: 'Family',
  },
  {
    photoUrl: 'https://images.unsplash.com/photo-1544027993-37dbfe43562a?w=800&h=600&fit=crop&auto=format',
    caption: 'Walking hand in hand with Susan through the autumn leaves.',
    speakText: 'You and Susan walked through the golden leaves, hand in hand. She never lets go of you, Margaret. Never.',
    person: 'Susan',
  },
];

function normalizePhotoUrl(url: string): string {
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

  if (user.familyPhotoUrl) {
    slides.push({
      id: 'family-hero',
      photoUrl: normalizePhotoUrl(user.familyPhotoUrl),
      caption: `A cherished moment with your family.`,
      speakText: `Oh, ${user.name.split(' ')[0]}… look at this beautiful moment with your family. They adore you, and you are never truly alone.`,
      person: 'Family',
    });
  }

  const album =
    user.name === 'Margaret' || user.name.toLowerCase().includes('margaret')
      ? MARGARET_MEMORY_ALBUM
      : MARGARET_MEMORY_ALBUM;

  album.forEach((s, i) => {
    if (s.photoUrl === user.familyPhotoUrl) return;
    slides.push({ ...s, id: `album-${i}` });
  });

  familiarFaces.forEach((face, i) => {
    if (slides.some((s) => s.person === face.name)) return;
    slides.push({
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
