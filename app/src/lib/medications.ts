import { db, type Medication, type User } from '../db/db';

export async function updateUserMedications(userId: number, medications: Medication[]): Promise<User | undefined> {
  const user = await db.users.get(userId);
  if (!user) return undefined;
  const updated = { ...user, medications };
  await db.users.put(updated);
  return updated;
}

export async function addMedication(userId: number, med: Medication): Promise<User | undefined> {
  const user = await db.users.get(userId);
  if (!user) return undefined;
  return updateUserMedications(userId, [...user.medications, med]);
}

export async function removeMedication(userId: number, index: number): Promise<User | undefined> {
  const user = await db.users.get(userId);
  if (!user) return undefined;
  const medications = user.medications.filter((_, i) => i !== index);
  return updateUserMedications(userId, medications);
}

export async function replaceMedication(userId: number, index: number, med: Medication): Promise<User | undefined> {
  const user = await db.users.get(userId);
  if (!user) return undefined;
  const medications = [...user.medications];
  medications[index] = med;
  return updateUserMedications(userId, medications);
}
