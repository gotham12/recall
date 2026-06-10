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
    photoUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=800&h=600&fit=crop',
    caption: 'You on the porch at Maple Lane — your favorite sunny spot.',
    speakText: 'Here you are on the porch at Maple Lane. You love sitting in the sun with Lily nearby.',
    person: 'Margaret',
  },
  {
    photoUrl: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=800&h=600&fit=crop',
    caption: 'Sunday dinner with Susan and Robert — everyone laughing.',
    speakText: 'Remember Sunday dinner? Susan and Robert were laughing, and you told your garden stories.',
    person: 'Family',
  },
  {
    photoUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=800&h=600&fit=crop',
    caption: "Susan's visit — she brought blueberry pie, just how you like it.",
    speakText: 'This is Susan, your daughter. She visits often and calls every day. She loves you very much.',
    person: 'Susan',
  },
  {
    photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&h=600&fit=crop',
    caption: 'Robert teaching you chess on the back porch.',
    speakText: 'Robert, your grandson, loves playing chess with you. He says you always win.',
    person: 'Robert',
  },
  {
    photoUrl: 'https://images.unsplash.com/photo-1464226184743-18fb080fad2d?w=800&h=600&fit=crop',
    caption: 'Your garden in full bloom — Susan helped you plant the roses.',
    speakText: 'Your garden was beautiful that spring. Susan helped you plant roses along the fence.',
    person: 'Margaret & Susan',
  },
  {
    photoUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&h=600&fit=crop',
    caption: 'A family picnic at Lake Quinsigamond — a perfect summer day.',
    speakText: 'The family picnic at the lake was a perfect day. Everyone was together, and you felt so happy.',
    person: 'Family',
  },
  {
    photoUrl: 'https://images.unsplash.com/photo-1533777857889-8be897c693ab?w=800&h=600&fit=crop',
    caption: 'Your 75th birthday — Susan and Robert surprised you.',
    speakText: 'On your seventy-fifth birthday, Susan and Robert surprised you. There was cake and so much love.',
    person: 'Family',
  },
  {
    photoUrl: 'https://images.unsplash.com/photo-1544027993-37dbfe43562a?w=800&h=600&fit=crop',
    caption: 'Walking hand in hand with Susan through the autumn leaves.',
    speakText: 'You and Susan walked through the autumn leaves together. She held your hand the whole way.',
    person: 'Susan',
  },
];

export function detectLoneliness(text: string): boolean {
  return LONELINESS_PATTERNS.some((p) => p.test(text));
}

export function buildMemorySlides(user: User, familiarFaces: FamiliarFace[] = []): MemorySlide[] {
  const slides: MemorySlide[] = [];

  if (user.familyPhotoUrl) {
    slides.push({
      id: 'family-hero',
      photoUrl: user.familyPhotoUrl.replace('w=400', 'w=800').replace('h=400', 'h=600'),
      caption: `A cherished moment with your family.`,
      speakText: `Look at this beautiful photo, ${user.name.split(' ')[0]}. Your family is always with you in spirit.`,
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
      photoUrl: face.photoUrl.replace('w=200', 'w=800').replace('h=200', 'h=600'),
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
