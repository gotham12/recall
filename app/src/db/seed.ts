import { db } from './db';

export async function seedIfEmpty(): Promise<void> {
  const userCount = await db.users.count();
  if (userCount >= 2) return;

  const now = new Date();
  const makeTime = (h: number, m = 0) => {
    const d = new Date(now);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };

  if (userCount === 0) {
    const userId = await db.users.add({
      name: 'Margaret',
      age: 78,
      city: 'Shrewsbury, MA',
      caregiverName: 'Susan',
      caregiverRelationship: 'daughter',
      familyPhotoUrl: undefined,
      calmingMusicUrl: undefined,
      medications: [
        { name: 'Metformin', dosage: '500mg', schedule: ['8:00 AM'] },
        { name: 'Lisinopril', dosage: '10mg', schedule: ['8:00 PM'] },
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
        timestamp: makeTime(11, 0),
        type: 'planned',
        title: "Daughter's phone call",
        description: 'Susan will call at 11:00 AM to check in.',
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

    await db.acseScores.add({
      userId,
      score: 100,
      timestamp: now.toISOString(),
      reason: 'Initial score',
    });

    await db.medicationLogs.add({
      userId,
      medicationName: 'Metformin',
      timestamp: makeTime(8, 5),
      visionConfidence: 'high',
      visionDescription: 'Pill bottle clearly visible.',
      confirmed: true,
    });
  }

  if ((await db.users.count()) < 2) {
    const userId2 = await db.users.add({
      name: 'Harold',
      age: 81,
      city: 'Worcester, MA',
      caregiverName: 'James',
      caregiverRelationship: 'son',
      familyPhotoUrl: undefined,
      calmingMusicUrl: undefined,
      medications: [
        { name: 'Amlodipine', dosage: '5mg', schedule: ['7:00 AM'] },
        { name: 'Donepezil', dosage: '10mg', schedule: ['9:00 PM'] },
      ],
      createdAt: now.toISOString(),
    });

    await db.events.bulkAdd([
      {
        userId: userId2,
        timestamp: makeTime(7, 15),
        type: 'user_action',
        title: 'Morning tea',
        description: 'Harold had tea and toast for breakfast.',
        completed: true,
        source: 'caregiver',
      },
      {
        userId: userId2,
        timestamp: makeTime(21, 0),
        type: 'planned',
        title: 'Donepezil — evening dose',
        description: 'Time to take Donepezil 10mg before bed.',
        completed: false,
        source: 'system',
      },
    ]);

    await db.acseScores.add({
      userId: userId2,
      score: 92,
      timestamp: now.toISOString(),
      reason: 'Initial score',
    });
  }
}
