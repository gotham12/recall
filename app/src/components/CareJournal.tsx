import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type CareJournalEntry } from '../db/db';
import { useAppStore } from '../store/appStore';
const MOODS: { id: CareJournalEntry['mood']; label: string; emoji: string }[] = [
  { id: 'great', label: 'Great', emoji: '+' },
  { id: 'good', label: 'Good', emoji: '' },
  { id: 'okay', label: 'Okay', emoji: '~' },
  { id: 'difficult', label: 'Difficult', emoji: '-' },
];

export default function CareJournal() {
  const { user } = useAppStore();
  const [mood, setMood] = useState<CareJournalEntry['mood']>('good');
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);

  const entries = useLiveQuery<CareJournalEntry[]>(
    () =>
      user?.id
        ? db.careJournal.where('userId').equals(user.id).reverse().sortBy('timestamp')
        : Promise.resolve([]),
    [user?.id]
  ) ?? [];

  const handleSave = async () => {
    if (!user?.id || !note.trim()) return;
    await db.careJournal.add({
      userId: user.id,
      timestamp: new Date().toISOString(),
      mood,
      note: note.trim(),
      author: user.caregiverName,
    });
    setNote('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="care-journal">
      <div className="card care-journal__form">
        <p className="studio-section-title">Care Journal</p>
        <p className="studio-text-muted" style={{ marginBottom: 12 }}>
          Log how {user?.name?.split(' ')[0]} is doing — notes feed Memory Threads tomorrow.
        </p>
        <div className="care-journal__moods">
          {MOODS.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`care-journal__mood tap-feedback ${mood === m.id ? 'care-journal__mood--active' : ''}`}
              onClick={() => setMood(m.id)}
            >
              <span>{m.emoji}</span>
              <span>{m.label}</span>
            </button>
          ))}
        </div>
        <textarea
          className="studio-textarea"
          rows={3}
          placeholder="e.g. Margaret was cheerful after lunch. Asked about Susan twice."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{ marginBottom: 10 }}
        />
        <button type="button" className="studio-btn studio-btn--primary tap-feedback" style={{ width: '100%' }} onClick={() => void handleSave()}>
          {saved ? 'Saved ✓' : 'Save journal entry'}
        </button>
      </div>

      {entries.slice(0, 5).map((e) => (
        <div key={e.id} className="card care-journal__entry">
          <div className="care-journal__entry-head">
            <span>{MOODS.find((m) => m.id === e.mood)?.emoji}</span>
            <span className="studio-text-muted" style={{ fontSize: 13 }}>
              {new Date(e.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 16 }}>{e.note}</p>
          <p className="studio-text-muted" style={{ fontSize: 13, margin: '4px 0 0' }}>— {e.author}</p>
        </div>
      ))}
      {entries.length === 0 && (
        <p className="studio-empty-note">No journal entries yet.</p>
      )}
    </div>
  );
}
