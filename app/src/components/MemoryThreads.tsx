import { useCallback, useEffect, useState } from 'react';
import { db } from '../db/db';
import { generateMemoryAnchors, type MemoryAnchor } from '../services/groq';
import { speak } from '../services/elevenlabs';
import { useAppStore } from '../store/appStore';
import StudioIcon from './StudioIcon';

/**
 * Recall Threads — AI-generated memory anchors woven into a tactile timeline.
 * Tap any thread bead; Clara speaks the grounding moment aloud.
 */
export default function MemoryThreads() {
  const user = useAppStore((s) => s.user);
  const acseScore = useAppStore((s) => s.acseScore);
  const [anchors, setAnchors] = useState<MemoryAnchor[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [speaking, setSpeaking] = useState(false);

  const loadAnchors = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      const cached = await db.memoryAnchors
        .where('userId')
        .equals(user.id)
        .toArray();

      const today = new Date().toDateString();
      const fresh = cached.find(
        (c) => new Date(c.generatedAt).toDateString() === today
      );

      if (fresh) {
        const sameDay = cached
          .filter((c) => new Date(c.generatedAt).toDateString() === today)
          .sort((a, b) => a.id! - b.id!);
        setAnchors(
          sameDay.map((c) => ({
            title: c.title,
            emoji: c.emoji,
            anchorText: c.anchorText,
            speakText: c.speakText,
          }))
        );
        return;
      }

      const [events, journal] = await Promise.all([
        db.events.where('userId').equals(user.id).toArray(),
        db.careJournal.where('userId').equals(user.id).toArray(),
      ]);
      const recent = events
        .filter((e) => e.completed)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5)
        .map((e) => e.title);

      const notes = journal
        .filter((j) => new Date(j.timestamp).toDateString() === today)
        .map((j) => j.note);

      const generated = await generateMemoryAnchors(
        user.name,
        user.city,
        user.caregiverName,
        user.caregiverRelationship,
        recent,
        notes
      );

      await db.memoryAnchors
        .where('userId')
        .equals(user.id)
        .delete();

      const ts = new Date().toISOString();
      for (const a of generated) {
        await db.memoryAnchors.add({
          userId: user.id,
          title: a.title,
          emoji: a.emoji,
          anchorText: a.anchorText,
          speakText: a.speakText,
          generatedAt: ts,
        });
      }

      setAnchors(generated);
    } catch (err) {
      console.error(err);
      setAnchors([
        {
          title: 'You are safe',
          emoji: '',
          anchorText: 'You are home, cared for, and loved.',
          speakText: 'You are safe at home. Take a slow breath. You are not alone.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadAnchors();
  }, [loadAnchors]);

  const handleTap = async (idx: number) => {
    const anchor = anchors[idx];
    if (!anchor || speaking) return;
    setActiveIdx(idx);
    setSpeaking(true);
    try {
      await speak(anchor.speakText);
    } finally {
      setSpeaking(false);
    }
  };

  const needsSupport = acseScore < 75;

  return (
    <section
      className={`memory-threads card ${needsSupport ? 'memory-threads--urgent' : ''}`}
      aria-labelledby="memory-threads-title"
    >
      <div className="memory-threads__header">
        <div>
          <p className="memory-threads__eyebrow">Recall Threads™</p>
          <h3 id="memory-threads-title" className="memory-threads__title">
            Your story, always within reach
          </h3>
          <p className="memory-threads__subtitle">
            Tap a memory bead — Clara will walk you through it
          </p>
        </div>
        <button
          type="button"
          className="studio-icon-btn tap-feedback"
          onClick={() => void loadAnchors()}
          aria-label="Refresh memory threads"
          disabled={loading}
        >
          <StudioIcon name="refresh" size={18} />
        </button>
      </div>

      {needsSupport && (
        <p className="memory-threads__nudge">
          <StudioIcon name="heart" size={16} />
          Your threads are glowing — let Clara guide you home
        </p>
      )}

      {loading ? (
        <div className="memory-threads__loading">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton memory-threads__bead-skeleton" />
          ))}
        </div>
      ) : (
        <div className="memory-threads__track" role="list">
          <svg className="memory-threads__line" viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden>
            <path
              d="M 0 20 Q 100 8, 200 20 T 400 20"
              fill="none"
              stroke="url(#thread-gradient)"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="thread-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--recall-coral)" />
                <stop offset="50%" stopColor="var(--recall-sage)" />
                <stop offset="100%" stopColor="var(--recall-lavender)" />
              </linearGradient>
            </defs>
          </svg>

          {anchors.map((anchor, idx) => (
            <button
              key={`${anchor.title}-${idx}`}
              type="button"
              role="listitem"
              className={`memory-threads__bead tap-feedback ${activeIdx === idx ? 'memory-threads__bead--active' : ''} ${speaking && activeIdx === idx ? 'memory-threads__bead--speaking' : ''}`}
              onClick={() => void handleTap(idx)}
              disabled={speaking}
            >
              <span className="memory-threads__emoji" aria-hidden>{anchor.emoji}</span>
              <span className="memory-threads__bead-title">{anchor.title}</span>
              <span className="memory-threads__bead-text">{anchor.anchorText}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
