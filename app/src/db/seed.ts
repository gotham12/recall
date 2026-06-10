import { db } from './db';
import { memoryPhotoUrl } from '../lib/memoryPhotos';

const MARGARET_HERO_PHOTO = memoryPhotoUrl('garden');
const MARGARET_SUSAN_PHOTO = memoryPhotoUrl('dinner');
const MARGARET_ROBERT_PHOTO = memoryPhotoUrl('picnic');
const MARGARET_LILY_PHOTO = memoryPhotoUrl('porch');

function makeTime(base: Date, h: number, m = 0): string {
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

function demoEventTimes(now: Date): { past: (h: number, m?: number) => string; future: (h: number, m?: number) => string } {
  const hour = now.getHours();

  if (hour < 10) {
    return {
      past: (h, m) => makeTime(now, h, m),
      future: (h, m) => makeTime(now, h, m),
    };
  }
  if (hour < 14) {
    return {
      past: (h, m) => makeTime(now, Math.min(h, hour - 1), m),
      future: (h, m) => makeTime(now, Math.max(h, hour + 1), m),
    };
  }
  return {
    past: (h, m) => makeTime(now, Math.min(h, 11), m),
    future: (h, m) => {
      const target = h <= 12 ? hour + 1 : h;
      return makeTime(now, Math.max(target, hour + 1), m);
    },
  };
}

const DEFAULT_ROUTINES = [
  { label: 'Brush teeth', period: 'morning' as const, sortOrder: 0 },
  { label: 'Take morning medication', period: 'morning' as const, sortOrder: 1 },
  { label: 'Eat breakfast', period: 'morning' as const, sortOrder: 2 },
  { label: 'Morning walk or stretch', period: 'morning' as const, sortOrder: 3 },
  { label: 'Daily Word puzzle', period: 'morning' as const, sortOrder: 4, gameId: 'wordle' as const },
  { label: 'Afternoon rest or activity', period: 'afternoon' as const, sortOrder: 0 },
  { label: 'Hydrate and snack', period: 'afternoon' as const, sortOrder: 1 },
  { label: 'Sudoku challenge', period: 'afternoon' as const, sortOrder: 2, gameId: 'sudoku' as const },
  { label: 'Word connections', period: 'afternoon' as const, sortOrder: 3, gameId: 'connections' as const },
  { label: 'Eat dinner', period: 'evening' as const, sortOrder: 0 },
  { label: 'Take evening medication', period: 'evening' as const, sortOrder: 1 },
  { label: 'Prepare for bed', period: 'evening' as const, sortOrder: 2 },
  { label: 'Log last night\'s sleep', period: 'morning' as const, sortOrder: 5 },
];

function seedSleepLogs(userId: number, now: Date): Promise<void> {
  const logs = [];
  for (let i = 7; i >= 1; i--) {
    const night = new Date(now);
    night.setDate(night.getDate() - i);
    const date = night.toISOString().slice(0, 10);
    const bedH = 21 + (i % 3);
    const wakeH = 6 + (i % 2);
    const quality = (3 + (i % 3)) as 1 | 2 | 3 | 4 | 5;
    const awakenings = i % 3;
    const bed = new Date(night);
    bed.setHours(bedH, 30, 0, 0);
    const wake = new Date(night);
    wake.setDate(wake.getDate() + 1);
    wake.setHours(wakeH, 15, 0, 0);
    logs.push({
      userId,
      date,
      bedTime: bed.toISOString(),
      wakeTime: wake.toISOString(),
      quality,
      awakenings,
      loggedBy: i % 2 === 0 ? 'patient' as const : 'caregiver' as const,
    });
  }
  return db.sleepLogs.bulkAdd(logs).then(() => undefined);
}

/** Remove legacy Harold demo profile from existing installs */
export async function purgeHaroldProfile(): Promise<void> {
  const harold = await db.users.where('name').equals('Harold').first();
  if (!harold?.id) return;

  const id = harold.id;
  await db.transaction('rw', [
    db.users, db.events, db.medicationLogs, db.acseScores, db.supervisorAlerts,
    db.memoryAnchors, db.emergencyContacts, db.routineTasks, db.familiarFaces, db.careJournal, db.sleepLogs,
  ], async () => {
    await db.events.where('userId').equals(id).delete();
    await db.medicationLogs.where('userId').equals(id).delete();
    await db.acseScores.where('userId').equals(id).delete();
    await db.supervisorAlerts.where('userId').equals(id).delete();
    await db.memoryAnchors.where('userId').equals(id).delete();
    await db.emergencyContacts.where('userId').equals(id).delete();
    await db.routineTasks.where('userId').equals(id).delete();
    await db.familiarFaces.where('userId').equals(id).delete();
    await db.sleepLogs.where('userId').equals(id).delete();
    await db.careJournal.where('userId').equals(id).delete();
    await db.users.delete(id);
  });
}

export async function seedIfEmpty(): Promise<void> {
  await purgeHaroldProfile();

  const userCount = await db.users.count();
  if (userCount >= 1) {
    await seedExtendedData();
    return;
  }

  const now = new Date();
  const t = demoEventTimes(now);

  const userId = await db.users.add({
    name: 'Margaret',
    age: 78,
    city: 'Shrewsbury, MA',
    homeAddress: '42 Maple Lane, Shrewsbury, MA',
    caregiverName: 'Susan',
    caregiverRelationship: 'daughter',
    caregiverPhone: '+15555550142',
    familyPhotoUrl: MARGARET_HERO_PHOTO,
    calmingMusicUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    emergencyNote: 'Margaret has mild dementia. Lives alone with daily caregiver visits. Allergic to penicillin.',
    onboardingComplete: true,
    medications: [
      { name: 'Metformin', dosage: '500mg', schedule: ['8:00 AM'] },
      { name: 'Lisinopril', dosage: '10mg', schedule: ['8:00 PM'] },
    ],
    createdAt: now.toISOString(),
  });

  await seedUserExtras(userId, 'Susan', 'daughter', '+15555550142', t, now);
}

async function seedUserExtras(
  userId: number,
  caregiverName: string,
  relationship: string,
  phone: string,
  t: ReturnType<typeof demoEventTimes>,
  now: Date
): Promise<void> {
  await db.events.bulkAdd([
    {
      userId,
      timestamp: t.past(7, 30),
      type: 'user_action',
      title: 'Breakfast',
      description: 'Margaret had oatmeal and orange juice for breakfast.',
      completed: true,
      source: 'caregiver',
    },
    {
      userId,
      timestamp: t.past(8, 5),
      type: 'user_action',
      title: 'Metformin taken',
      description: 'Margaret took Metformin 500mg. Vision verified.',
      completed: true,
      source: 'system',
    },
    {
      userId,
      timestamp: t.past(9, 15),
      type: 'user_action',
      title: 'Morning walk',
      description: 'Margaret took a 20-minute walk in the garden.',
      completed: true,
      source: 'caregiver',
    },
    {
      userId,
      timestamp: t.future(11, 0),
      type: 'planned',
      title: "Daughter's phone call",
      description: 'Susan will call at 11:00 AM to check in.',
      completed: false,
      source: 'caregiver',
    },
    {
      userId,
      timestamp: t.future(20, 0),
      type: 'planned',
      title: 'Lisinopril — evening dose',
      description: 'Time to take Lisinopril 10mg with a glass of water.',
      completed: false,
      source: 'system',
    },
  ]);

  await db.acseScores.add({
    userId,
    score: 100,
    timestamp: now.toISOString(),
    reason: 'Initial score',
  });

  await db.medicationLogs.add({
    userId,
    medicationName: 'Metformin',
    timestamp: t.past(8, 5),
    visionConfidence: 'high',
    visionDescription: 'Pill bottle clearly visible.',
    confirmed: true,
  });

  await db.emergencyContacts.bulkAdd([
    { userId, name: caregiverName, relationship, phone, isPrimary: true },
    { userId, name: 'Dr. Chen', relationship: 'physician', phone: '+15555550311', isPrimary: false },
    { userId, name: 'Neighbor Tom', relationship: 'neighbor', phone: '+15555550456', isPrimary: false },
  ]);

  await db.routineTasks.bulkAdd(DEFAULT_ROUTINES.map((r) => ({ ...r, userId })));

  await db.familiarFaces.bulkAdd([
    {
      userId,
      name: 'Susan',
      relationship: 'Daughter',
      photoUrl: MARGARET_SUSAN_PHOTO,
      memoryPrompt: 'This is your daughter Susan. She calls you every day and visited last Sunday with blueberry pie.',
    },
    {
      userId,
      name: 'Robert',
      relationship: 'Grandson',
      photoUrl: MARGARET_ROBERT_PHOTO,
      memoryPrompt: 'This is Robert, your grandson. He is 12 and loves playing chess with you on the porch.',
    },
    {
      userId,
      name: 'Lily',
      relationship: 'Cat',
      photoUrl: MARGARET_LILY_PHOTO,
      memoryPrompt: 'This is Lily, your cat. She sleeps on the sunny windowsill every afternoon.',
    },
  ]);

  await db.careJournal.bulkAdd([
    {
      userId,
      timestamp: makeTime(now, 8, 30),
      mood: 'good',
      note: 'Margaret was cheerful at breakfast. Remembered Susan\'s visit from Sunday.',
      author: caregiverName,
    },
    {
      userId,
      timestamp: makeTime(now, 12, 0),
      mood: 'okay',
      note: 'Asked about medication twice before noon. Gently redirected both times.',
      author: caregiverName,
    },
  ]);

  await seedSleepLogs(userId, now);
}

/** Backfill v3 tables for existing installs */
async function seedExtendedData(): Promise<void> {
  const users = await db.users.toArray();
  for (const user of users) {
    if (!user.id) continue;
    const hasRoutines = (await db.routineTasks.where('userId').equals(user.id).count()) > 0;
    if (!hasRoutines) {
      await db.routineTasks.bulkAdd(DEFAULT_ROUTINES.map((r) => ({ ...r, userId: user.id! })));
    }
    const hasContacts = (await db.emergencyContacts.where('userId').equals(user.id).count()) > 0;
    if (!hasContacts && user.caregiverPhone) {
      await db.emergencyContacts.add({
        userId: user.id,
        name: user.caregiverName,
        relationship: user.caregiverRelationship,
        phone: user.caregiverPhone,
        isPrimary: true,
      });
    }
    if (!user.homeAddress && user.city) {
      await db.users.update(user.id, { homeAddress: user.city, onboardingComplete: true });
    }
    if (!user.emergencyNote) {
      await db.users.update(user.id, {
        emergencyNote: `${user.name} uses Recall for cognitive support. Contact ${user.caregiverName} first.`,
      });
    }
    if (user.name === 'Margaret' && user.familyPhotoUrl?.includes('unsplash.com')) {
      await db.users.update(user.id, { familyPhotoUrl: MARGARET_HERO_PHOTO });
    }
    const hasFaces = (await db.familiarFaces.where('userId').equals(user.id).count()) > 0;
    if (!hasFaces && user.name === 'Margaret') {
      await db.familiarFaces.bulkAdd([
        {
          userId: user.id,
          name: 'Susan',
          relationship: 'Daughter',
          photoUrl: MARGARET_SUSAN_PHOTO,
          memoryPrompt: 'This is your daughter Susan. She calls you every day.',
        },
        {
          userId: user.id,
          name: 'Robert',
          relationship: 'Grandson',
          photoUrl: MARGARET_ROBERT_PHOTO,
          memoryPrompt: 'This is Robert, your grandson. He loves playing chess with you.',
        },
      ]);
    }
    if (user.name === 'Margaret') {
      const faces = await db.familiarFaces.where('userId').equals(user.id).toArray();
      for (const face of faces) {
        if (!face.id || !face.photoUrl?.includes('unsplash.com')) continue;
        const photoUrl =
          face.name === 'Susan' ? MARGARET_SUSAN_PHOTO
          : face.name === 'Robert' ? MARGARET_ROBERT_PHOTO
          : face.name === 'Lily' ? MARGARET_LILY_PHOTO
          : MARGARET_HERO_PHOTO;
        await db.familiarFaces.update(face.id, { photoUrl });
      }
    }
    const hasSleep = (await db.sleepLogs.where('userId').equals(user.id).count()) > 0;
    if (!hasSleep && user.name === 'Margaret') {
      await seedSleepLogs(user.id, new Date());
    }
    if (user.name === 'Margaret') {
      const tasks = await db.routineTasks.where('userId').equals(user.id).toArray();
      const labels = new Set(tasks.map((t) => t.label));
      const missing = DEFAULT_ROUTINES.filter((r) => !labels.has(r.label));
      if (missing.length > 0) {
        await db.routineTasks.bulkAdd(missing.map((r) => ({ ...r, userId: user.id! })));
      }
    }
  }
}
