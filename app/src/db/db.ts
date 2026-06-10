import Dexie, { type Table } from 'dexie';

export interface User {
  id?: number;
  name: string;
  age: number;
  city: string;
  homeAddress?: string;
  caregiverName: string;
  caregiverRelationship: string;
  caregiverPhone?: string;
  familyPhotoUrl?: string;
  calmingMusicUrl?: string;
  emergencyNote?: string;
  patientPin?: string;
  onboardingComplete?: boolean;
  medications: Medication[];
  createdAt: string;
}

export interface Medication {
  name: string;
  dosage: string;
  schedule: string[];
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

export interface SupervisorAlertRecord {
  id?: number;
  userId: number;
  message: string;
  timestamp: string;
  type: 'comfort_mode' | 'medication_unconfirmed' | 'general' | 'presence' | 'sos';
  dismissed: boolean;
}

export interface MemoryAnchorRecord {
  id?: number;
  userId: number;
  title: string;
  emoji: string;
  anchorText: string;
  speakText: string;
  generatedAt: string;
}

export interface EmergencyContact {
  id?: number;
  userId: number;
  name: string;
  relationship: string;
  phone: string;
  isPrimary?: boolean;
}

export type CognitiveGameId = 'wordle' | 'sudoku' | 'connections';

export interface RoutineTask {
  id?: number;
  userId: number;
  label: string;
  period: 'morning' | 'afternoon' | 'evening';
  sortOrder: number;
  completedAt?: string;
  gameId?: CognitiveGameId;
}

export interface SleepLog {
  id?: number;
  userId: number;
  /** Calendar date of the night (YYYY-MM-DD) */
  date: string;
  bedTime: string;
  wakeTime: string;
  quality: 1 | 2 | 3 | 4 | 5;
  awakenings: number;
  notes?: string;
  loggedBy: 'patient' | 'caregiver';
}

export interface FamiliarFace {
  id?: number;
  userId: number;
  name: string;
  relationship: string;
  photoUrl: string;
  memoryPrompt: string;
}

export interface CareJournalEntry {
  id?: number;
  userId: number;
  timestamp: string;
  mood: 'great' | 'good' | 'okay' | 'difficult';
  note: string;
  author: string;
}

class RecallDB extends Dexie {
  users!: Table<User>;
  events!: Table<Event>;
  medicationLogs!: Table<MedicationLog>;
  acseScores!: Table<AcseScore>;
  supervisorAlerts!: Table<SupervisorAlertRecord>;
  memoryAnchors!: Table<MemoryAnchorRecord>;
  emergencyContacts!: Table<EmergencyContact>;
  routineTasks!: Table<RoutineTask>;
  familiarFaces!: Table<FamiliarFace>;
  careJournal!: Table<CareJournalEntry>;
  sleepLogs!: Table<SleepLog>;

  constructor() {
    super('RecallDB');
    this.version(1).stores({
      users: '++id, name',
      events: '++id, userId, timestamp, type, completed',
      medicationLogs: '++id, userId, medicationName, timestamp',
      acseScores: '++id, userId, timestamp',
    });
    this.version(2).stores({
      users: '++id, name',
      events: '++id, userId, timestamp, type, completed',
      medicationLogs: '++id, userId, medicationName, timestamp',
      acseScores: '++id, userId, timestamp',
      supervisorAlerts: '++id, userId, timestamp, dismissed',
      memoryAnchors: '++id, userId, generatedAt',
    });
    this.version(3).stores({
      users: '++id, name',
      events: '++id, userId, timestamp, type, completed',
      medicationLogs: '++id, userId, medicationName, timestamp',
      acseScores: '++id, userId, timestamp',
      supervisorAlerts: '++id, userId, timestamp, dismissed',
      memoryAnchors: '++id, userId, generatedAt',
      emergencyContacts: '++id, userId',
      routineTasks: '++id, userId, period',
      familiarFaces: '++id, userId',
      careJournal: '++id, userId, timestamp',
    });
    this.version(4).stores({
      users: '++id, name',
      events: '++id, userId, timestamp, type, completed',
      medicationLogs: '++id, userId, medicationName, timestamp',
      acseScores: '++id, userId, timestamp',
      supervisorAlerts: '++id, userId, timestamp, dismissed',
      memoryAnchors: '++id, userId, generatedAt',
      emergencyContacts: '++id, userId',
      routineTasks: '++id, userId, period',
      familiarFaces: '++id, userId',
      careJournal: '++id, userId, timestamp',
      sleepLogs: '++id, userId, date',
    });
  }
}

export const db = new RecallDB();
