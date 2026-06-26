import { db } from './db';
import { memoryPhotoUrl } from '../lib/memoryPhotos';
import { FAMILY_PHOTOS } from '../lib/assets';
import { DEFAULT_ROUTINES } from '../lib/defaultRoutines';
import { DEMO_TYLENOL } from '../lib/medicationVision';
import { useAppStore } from '../store/appStore';

const MARGARET_HERO_PHOTO = memoryPhotoUrl('garden');
const MARGARET_SUSAN_PHOTO = FAMILY_PHOTOS.susan;
const MARGARET_ROBERT_PHOTO = FAMILY_PHOTOS.robert;
const MARGARET_LILY_PHOTO = FAMILY_PHOTOS.lily;

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
      notes: 'Synced from Apple Watch via Apple Health',
      loggedBy: 'apple_watch' as const,
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

async function purgeDuplicates(): Promise<void> {
  const users = await db.users.toArray();
  const seen = new Map<string, number>();
  for (const user of users) {
    if (!user.id) continue;
    const key = user.name.trim().toLowerCase();
    if (seen.has(key)) {
      // Keep the first; delete duplicates
      const dupId = user.id;
      await db.transaction('rw', [
        db.users, db.events, db.medicationLogs, db.acseScores, db.supervisorAlerts,
        db.memoryAnchors, db.emergencyContacts, db.routineTasks, db.familiarFaces, db.careJournal, db.sleepLogs,
      ], async () => {
        await db.events.where('userId').equals(dupId).delete();
        await db.medicationLogs.where('userId').equals(dupId).delete();
        await db.acseScores.where('userId').equals(dupId).delete();
        await db.supervisorAlerts.where('userId').equals(dupId).delete();
        await db.memoryAnchors.where('userId').equals(dupId).delete();
        await db.emergencyContacts.where('userId').equals(dupId).delete();
        await db.routineTasks.where('userId').equals(dupId).delete();
        await db.familiarFaces.where('userId').equals(dupId).delete();
        await db.sleepLogs.where('userId').equals(dupId).delete();
        await db.careJournal.where('userId').equals(dupId).delete();
        await db.users.delete(dupId);
      });
    } else {
      seen.set(key, user.id);
    }
  }
}

export async function seedIfEmpty(): Promise<void> {
  await purgeHaroldProfile();
  await purgeDuplicates();

  const userCount = await db.users.count();
  if (userCount >= 1) {
    await seedExtendedData();
    await syncMargaretFamilyData();
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
      DEMO_TYLENOL,
      { name: 'Donepezil', dosage: '10mg', schedule: ['8:00 AM'] },
      { name: 'Levodopa/Carbidopa', dosage: '25-100mg', schedule: ['8:00 AM', '2:00 PM', '8:00 PM'] },
      { name: 'Memantine', dosage: '5mg', schedule: ['8:00 PM'] },
    ],
    createdAt: now.toISOString(),
  });

  await seedUserExtras(userId, 'Susan', 'daughter', '+15555550142', t, now);
  await syncMargaretFamilyData();
}

function nextCheckupTimestamp(from: Date): string {
  const d = new Date(from);
  d.setDate(d.getDate() + 14);
  d.setHours(10, 30, 0, 0);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  return d.toISOString();
}

async function ensureCheckupAppointment(userId: number): Promise<void> {
  const events = await db.events.where('userId').equals(userId).toArray();
  const hasCheckup = events.some((e) => {
    const blob = `${e.title} ${e.description}`.toLowerCase();
    return blob.includes('checkup') || blob.includes('dr. chen');
  });
  if (hasCheckup) return;

  await db.events.add({
    userId,
    timestamp: nextCheckupTimestamp(new Date()),
    type: 'planned',
    title: 'Checkup with Dr. Chen',
    description: 'Cognitive follow-up appointment. Susan will drive Margaret to the clinic.',
    completed: false,
    source: 'caregiver',
  });
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/** Keep Margaret demo photos + safety circle in sync on every app load */
async function syncMargaretFamilyData(): Promise<void> {
  const users = await db.users.toArray();
  for (const user of users) {
    if (user.name !== 'Margaret' || !user.id) continue;

    const faces = await db.familiarFaces.where('userId').equals(user.id).toArray();
    for (const face of faces) {
      if (!face.id) continue;
      const photo =
        face.name === 'Susan' ? MARGARET_SUSAN_PHOTO
        : face.name === 'Robert' ? MARGARET_ROBERT_PHOTO
        : face.name === 'Lily' ? MARGARET_LILY_PHOTO
        : null;
      if (photo && face.photoUrl !== photo) {
        await db.familiarFaces.update(face.id, { photoUrl: photo });
      }
    }

    const caregiverPhone = normalizePhone(user.caregiverPhone ?? '');
    const caregiverName = user.caregiverName?.trim().toLowerCase() ?? '';
    const contacts = await db.emergencyContacts.where('userId').equals(user.id).toArray();

    for (const contact of contacts) {
      if (!contact.id) continue;
      const sameName = contact.name.trim().toLowerCase() === caregiverName;
      const samePhone = normalizePhone(contact.phone) === caregiverPhone;
      if (sameName || samePhone) {
        await db.emergencyContacts.delete(contact.id);
      }
    }

    const remaining = await db.emergencyContacts.where('userId').equals(user.id).toArray();
    const hasRobert = remaining.some((c) => c.name.trim().toLowerCase() === 'robert');
    if (!hasRobert) {
      await db.emergencyContacts.add({
        userId: user.id,
        name: 'Robert',
        relationship: 'Grandson',
        phone: '+15555550187',
        isPrimary: false,
      });
    }

    if (!faces.some((f) => f.name === 'Lily')) {
      await db.familiarFaces.add({
        userId: user.id,
        name: 'Lily',
        relationship: 'Cat',
        photoUrl: MARGARET_LILY_PHOTO,
        memoryPrompt: 'This is Lily, your cat. She sleeps on the sunny windowsill every afternoon.',
      });
    }

    await ensureRoutineGameTasks(user.id);
    await ensureDemoTylenol(user.id);
    await ensureCheckupAppointment(user.id);
  }
}

async function ensureDemoTylenol(userId: number): Promise<void> {
  const user = await db.users.get(userId);
  if (!user?.id || user.name !== 'Margaret') return;

  const hasTylenol = user.medications?.some((m) => m.name.toLowerCase().includes('tylenol'));
  if (hasTylenol) return;

  const medications = [DEMO_TYLENOL, ...(user.medications ?? [])];
  await db.users.update(userId, { medications });

  const active = useAppStore.getState().user;
  if (active?.id === userId) {
    useAppStore.setState({ user: { ...active, medications } });
  }
}

/** Ensure Wordle, Sudoku, and Connections are in Margaret's daily routine */
async function ensureRoutineGameTasks(userId: number): Promise<void> {
  const tasks = await db.routineTasks.where('userId').equals(userId).toArray();
  const labels = new Set(tasks.map((t) => t.label));
  const missing = DEFAULT_ROUTINES.filter((r) => !labels.has(r.label));
  if (missing.length > 0) {
    await db.routineTasks.bulkAdd(missing.map((r) => ({ ...r, userId })));
  }
  for (const task of tasks) {
    if (!task.id) continue;
    const template = DEFAULT_ROUTINES.find((r) => r.label === task.label);
    if (template?.gameId && task.gameId !== template.gameId) {
      await db.routineTasks.update(task.id, { gameId: template.gameId });
    }
  }
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
      title: 'Donepezil taken',
      description: 'Margaret took Donepezil 10mg. Vision verified.',
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
      title: 'Memantine — evening dose',
      description: 'Time to take Memantine 5mg with a glass of water.',
      completed: false,
      source: 'system',
    },
    {
      userId,
      timestamp: nextCheckupTimestamp(now),
      type: 'planned',
      title: 'Checkup with Dr. Chen',
      description: 'Cognitive follow-up appointment. Susan will drive Margaret to the clinic.',
      completed: false,
      source: 'caregiver',
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
    medicationName: 'Donepezil',
    timestamp: t.past(8, 5),
    visionConfidence: 'high',
    visionDescription: 'Pill bottle clearly visible.',
    confirmed: true,
  });

  await db.emergencyContacts.bulkAdd([
    { userId, name: 'Robert', relationship: 'Grandson', phone: '+15555550187', isPrimary: false },
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
    if (!hasContacts && user.name === 'Margaret') {
      await db.emergencyContacts.bulkAdd([
        { userId: user.id, name: 'Robert', relationship: 'Grandson', phone: '+15555550187', isPrimary: false },
        { userId: user.id, name: 'Dr. Chen', relationship: 'physician', phone: '+15555550311', isPrimary: false },
        { userId: user.id, name: 'Neighbor Tom', relationship: 'neighbor', phone: '+15555550456', isPrimary: false },
      ]);
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
        {
          userId: user.id,
          name: 'Lily',
          relationship: 'Cat',
          photoUrl: MARGARET_LILY_PHOTO,
          memoryPrompt: 'This is Lily, your cat. She sleeps on the sunny windowsill every afternoon.',
        },
      ]);
    }
    if (user.name === 'Margaret') {
      const faces = await db.familiarFaces.where('userId').equals(user.id).toArray();
      for (const face of faces) {
        if (!face.id) continue;
        const photoUrl =
          face.name === 'Susan' ? MARGARET_SUSAN_PHOTO
          : face.name === 'Robert' ? MARGARET_ROBERT_PHOTO
          : face.name === 'Lily' ? MARGARET_LILY_PHOTO
          : null;
        if (photoUrl && face.photoUrl !== photoUrl) {
          await db.familiarFaces.update(face.id, { photoUrl });
        }
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
    // Auto-connect Apple Health for Margaret so sleep shows as watch-sourced
    if (user.name === 'Margaret' && user.id) {
      const ahKey = `recall_apple_health_${user.id}`;
      const ahRaw = localStorage.getItem(ahKey);
      if (!ahRaw || !JSON.parse(ahRaw).connected) {
        localStorage.setItem(ahKey, JSON.stringify({
          connected: true,
          lastSyncAt: new Date().toISOString(),
          deviceName: "Margaret's Apple Watch",
        }));
      }
    }
    // Migrate old medications to neurodegenerative drugs
    if (user.name === 'Margaret' && user.medications?.some(m => m.name === 'Metformin' || m.name === 'Lisinopril')) {
      await db.users.update(user.id, {
        medications: [
          DEMO_TYLENOL,
          { name: 'Donepezil', dosage: '10mg', schedule: ['8:00 AM'] },
          { name: 'Levodopa/Carbidopa', dosage: '25-100mg', schedule: ['8:00 AM', '2:00 PM', '8:00 PM'] },
          { name: 'Memantine', dosage: '5mg', schedule: ['8:00 PM'] },
        ],
      });
    }
    if (user.name === 'Margaret' && user.id) {
      await ensureDemoTylenol(user.id);
    }
  }
}
