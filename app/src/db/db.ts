import Dexie, { type Table } from 'dexie';

export interface User {
  id?: number;
  name: string;
  age: number;
  city: string;
  caregiverName: string;
  caregiverRelationship: string;
  familyPhotoUrl?: string;
  calmingMusicUrl?: string;
  medications: Medication[];
  createdAt: string;
}

export interface Medication {
  name: string;
  dosage: string;
  schedule: string[]; // e.g. ["8:00 AM", "8:00 PM"]
}

export interface Event {
  id?: number;
  userId: number;
  timestamp: string;
  type: 'user_action' | 'planned' | 'caregiver_input' | 'system_alert';
  title: string;
  description: string;
  completed: boolean;
  source: string;
}

export interface MedicationLog {
  id?: number;
  userId: number;
  medicationName: string;
  timestamp: string;
  visionConfidence: 'high' | 'medium' | 'low' | 'manual' | 'unconfirmed';
  visionDescription: string;
  imageThumbnail?: string;
  confirmed: boolean;
}

export interface AcseScore {
  id?: number;
  userId: number;
  score: number;
  timestamp: string;
  reason?: string;
}

class RecallDB extends Dexie {
  users!: Table<User>;
  events!: Table<Event>;
  medicationLogs!: Table<MedicationLog>;
  acseScores!: Table<AcseScore>;

  constructor() {
    super('RecallDB');
    this.version(1).stores({
      users: '++id, name',
      events: '++id, userId, timestamp, type, completed',
      medicationLogs: '++id, userId, medicationName, timestamp',
      acseScores: '++id, userId, timestamp',
    });
  }
}

export const db = new RecallDB();
