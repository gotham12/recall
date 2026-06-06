import Dexie, { type Table } from 'dexie';

export interface Medication {
  name: string;
  dosage: string;
  schedule: string[];
}

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

export interface RecallEvent {
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
  escalated?: boolean;
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
  events!: Table<RecallEvent>;
  medicationLogs!: Table<MedicationLog>;
  acseScores!: Table<AcseScore>;

  constructor() {
    super('RecallDB_v2');
    this.version(1).stores({
      users: '++id, name',
      events: '++id, userId, timestamp, type, completed',
      medicationLogs: '++id, userId, medicationName, timestamp, confirmed',
      acseScores: '++id, userId, timestamp',
    });
  }
}

export const db = new RecallDB();
