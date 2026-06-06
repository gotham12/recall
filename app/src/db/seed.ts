import { db } from './db';

export async function seedIfEmpty(): Promise<void> {
  const count = await db.users.count();
  if (count > 0) return;

  const now = new Date();

  const makeTime = (h: number, m = 0) => {
    const d = new Date(now);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };

  // Future events relative to current time
  const inMinutes = (mins: number) => new Date(Date.now() + mins * 60000).toISOString();

  const userId = await db.users.add({
    name: 'Margaret',
    age: 78,
    city: 'Shrewsbury, MA',
    caregiverName: 'Susan',
    caregiverRelationship: 'daughter',
    familyPhotoUrl: undefined,
    calmingMusicUrl: undefined,
    medications: [
      { name: 'Metformin',  dosage: '500mg', schedule: ['8:00 AM'] },
      { name: 'Lisinopril', dosage: '10mg',  schedule: ['8:00 PM'] },
    ],
    createdAt: now.toISOString(),
  });

  await db.events.bulkAdd([
    {
      userId,
      timestamp: makeTime(7, 30),
      type: 'user_action',
      title: 'Breakfast',
      description: 'Margaret had oatmeal and orange juice for breakfast.',
      completed: true,
      source: 'caregiver',
    },
    {
      userId,
      timestamp: makeTime(8, 5),
      type: 'user_action',
      title: 'Metformin taken',
      description: 'Margaret took Metformin 500mg. Vision verified.',
      completed: true,
      source: 'system',
    },
    {
      userId,
      timestamp: makeTime(9, 15),
      type: 'user_action',
      title: 'Morning walk',
      description: 'Margaret took a 20-minute walk in the garden.',
      completed: true,
      source: 'caregiver',
    },
    {
      userId,
      timestamp: inMinutes(45),
      type: 'planned',
      title: "Susan's phone call",
      description: "Susan will call to check in and chat.",
      completed: false,
      source: 'caregiver',
    },
    {
      userId,
      timestamp: makeTime(20, 0),
      type: 'planned',
      title: 'Lisinopril — evening dose',
      description: 'Time to take Lisinopril 10mg with a glass of water.',
      completed: false,
      source: 'system',
    },
  ]);

  await db.medicationLogs.add({
    userId,
    medicationName: 'Metformin',
    timestamp: makeTime(8, 5),
    visionConfidence: 'high',
    visionDescription: 'Pill bottle clearly visible with label.',
    confirmed: true,
  });

  await db.acseScores.add({
    userId,
    score: 100,
    timestamp: now.toISOString(),
    reason: 'Initial score',
  });
}
