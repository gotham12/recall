import { useCallback, useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type FamiliarFace } from '../db/db';
import { useAppStore } from '../store/appStore';
import { buildMemorySlides, type MemorySlide } from '../lib/memoryRecap';
import { speak, stopSpeaking } from '../services/elevenlabs';
import StudioIcon from './StudioIcon';

const SLIDE_MS = 5_500;

export default function MemoryPhotoRecap() {
  const { user, memoryRecapActive, memoryRecapReason, dismissMemoryRecap } = useAppStore();
  const [slides, setSlides] = useState<MemorySlide[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const faces = useLiveQuery<FamiliarFace[]>(
    () => (user?.id ? db.familiarFaces.where('userId').equals(user.id).toArray() : []),
    [user?.id]
  ) ?? [];

  const startRecap = useCallback(() => {
    if (!user) return;
    const album = buildMemorySlides(user, faces);
    setSlides(album);
    setIndex(0);
    setPlaying(true);
  }, [user, faces]);

  useEffect(() => {
    if (memoryRecapActive && user) {
      startRecap();
    } else {
      setPlaying(false);
      stopSpeaking();
      if (timerRef.current) clearTimeout(timerRef.current);
    }
  }, [memoryRecapActive, user, startRecap]);

  const advance = useCallback(() => {
    setIndex((i) => {
      if (slides.length === 0) return 0;
      return (i + 1) % slides.length;
    });
  }, [slides.length]);

  useEffect(() => {
    if (!playing || slides.length === 0) return;

    const slide = slides[index];
    void speak(slide.speakText).catch(console.error);

    timerRef.current = setTimeout(advance, SLIDE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [playing, index, slides, advance]);

  const handleClose = () => {
    stopSpeaking();
    setPlaying(false);
    dismissMemoryRecap();
  };

  if (!memoryRecapActive) return null;

  if (slides.length === 0) {
    return (
      <div className="memory-recap" role="dialog" aria-label="Loading memories">
        <div className="memory-recap__backdrop" />
        <div className="memory-recap__panel memory-recap__panel--loading">
          <p className="memory-recap__loading">Gathering your family memories…</p>
        </div>
      </div>
    );
  }

  const slide = slides[index];
  const firstName = user?.name?.split(' ')[0] ?? 'friend';

  return (
    <div className="memory-recap" role="dialog" aria-label="Family memory recap">
      <div className="memory-recap__backdrop" onClick={handleClose} aria-hidden />

      <div className="memory-recap__panel">
        <header className="memory-recap__header">
          <div>
            <p className="memory-recap__eyebrow">
              {memoryRecapReason === 'loneliness'
                ? 'Clara noticed you might feel alone'
                : 'Family Memory Recap™'}
            </p>
            <h2 className="memory-recap__title">{firstName}, you are loved</h2>
          </div>
          <button type="button" className="studio-icon-btn tap-feedback" onClick={handleClose} aria-label="Close">
            <StudioIcon name="close" size={20} />
          </button>
        </header>

        <div className="memory-recap__stage">
          <div className="memory-recap__photo-wrap" key={slide.id}>
            <img
              src={slide.photoUrl}
              alt={slide.caption}
              className="memory-recap__photo memory-recap__photo--enter"
            />
            <div className="memory-recap__caption">
              {slide.person && <span className="memory-recap__person">{slide.person}</span>}
              <p>{slide.caption}</p>
            </div>
          </div>

          <div className="memory-recap__progress">
            {slides.map((s, i) => (
              <span
                key={s.id}
                className={`memory-recap__dot ${i === index ? 'memory-recap__dot--active' : ''}`}
              />
            ))}
          </div>
        </div>

        <footer className="memory-recap__footer">
          <button type="button" className="studio-btn tap-feedback" onClick={advance}>
            <StudioIcon name="refresh" size={18} /> Next memory
          </button>
          <button type="button" className="studio-btn studio-btn--primary tap-feedback" onClick={startRecap}>
            <StudioIcon name="heart" size={18} /> Shuffle again
          </button>
        </footer>
      </div>
    </div>
  );
}
