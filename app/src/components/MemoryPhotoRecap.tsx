import { useCallback, useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type FamiliarFace } from '../db/db';
import { useAppStore } from '../store/appStore';
import { buildMemorySlides, type MemorySlide } from '../lib/memoryRecap';
import { speak, stopSpeaking } from '../services/elevenlabs';
import StudioIcon from './StudioIcon';

const FALLBACK_PHOTO =
  'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=800&h=600&fit=crop&auto=format';

export default function MemoryPhotoRecap() {
  const { user, memoryRecapActive, memoryRecapReason, dismissMemoryRecap } = useAppStore();
  const [slides, setSlides] = useState<MemorySlide[]>([]);
  const [index, setIndex] = useState(0);
  const [imgSrc, setImgSrc] = useState('');
  const sessionRef = useRef(0);
  const slidesRef = useRef<MemorySlide[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const faces = useLiveQuery<FamiliarFace[]>(
    () => (user?.id ? db.familiarFaces.where('userId').equals(user.id).toArray() : []),
    [user?.id]
  ) ?? [];

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cancelRecap = useCallback(() => {
    sessionRef.current += 1;
    clearTimer();
    stopSpeaking();
  }, [clearTimer]);

  const playSlideAt = useCallback(async (idx: number, session: number) => {
    const list = slidesRef.current;
    const slide = list[idx];
    if (!slide || session !== sessionRef.current) return;

    clearTimer();
    stopSpeaking();
    setIndex(idx);
    setImgSrc(slide.photoUrl);

    try {
      await speak(slide.speakText, { warm: true });
    } catch (err) {
      console.error(err);
    }

    if (session !== sessionRef.current || list.length <= 1) return;

    timerRef.current = setTimeout(() => {
      if (session !== sessionRef.current) return;
      void playSlideAt((idx + 1) % list.length, session);
    }, 700);
  }, [clearTimer]);

  const startRecap = useCallback(() => {
    if (!user) return;
    cancelRecap();
    const session = sessionRef.current;
    const album = buildMemorySlides(user, faces);
    slidesRef.current = album;
    setSlides(album);
    if (album.length === 0) return;
    void playSlideAt(0, session);
  }, [user, faces, cancelRecap, playSlideAt]);

  useEffect(() => {
    if (memoryRecapActive && user) {
      startRecap();
    } else if (!memoryRecapActive) {
      cancelRecap();
      setSlides([]);
      setIndex(0);
      setImgSrc('');
    }
  }, [memoryRecapActive, user, startRecap, cancelRecap]);

  useEffect(() => () => cancelRecap(), [cancelRecap]);

  const handleClose = () => {
    cancelRecap();
    dismissMemoryRecap();
  };

  const handleNext = () => {
    const list = slidesRef.current;
    if (list.length === 0) return;
    const session = sessionRef.current;
    const next = (index + 1) % list.length;
    void playSlideAt(next, session);
  };

  const handleShuffle = () => {
    startRecap();
  };

  const handleImgError = () => {
    setImgSrc(FALLBACK_PHOTO);
  };

  if (!memoryRecapActive) return null;

  if (slides.length === 0) {
    return (
      <div className="memory-recap" role="dialog" aria-label="Loading memories">
        <div className="memory-recap__backdrop" onClick={handleClose} />
        <div className="memory-recap__panel memory-recap__panel--loading">
          <p className="memory-recap__loading">Gathering your family memories…</p>
        </div>
      </div>
    );
  }

  const slide = slides[index] ?? slides[0];
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
            <h2 className="memory-recap__title">{firstName}, you are so loved</h2>
          </div>
          <button type="button" className="studio-icon-btn tap-feedback" onClick={handleClose} aria-label="Close">
            <StudioIcon name="close" size={20} />
          </button>
        </header>

        <div className="memory-recap__stage">
          <div className="memory-recap__photo-wrap" key={`${slide.id}-${imgSrc}`}>
            <img
              src={imgSrc || slide.photoUrl}
              alt={slide.caption}
              className="memory-recap__photo memory-recap__photo--enter"
              loading="eager"
              decoding="async"
              onError={handleImgError}
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
          <button type="button" className="studio-btn tap-feedback" onClick={handleNext}>
            <StudioIcon name="refresh" size={18} /> Next memory
          </button>
          <button type="button" className="studio-btn studio-btn--primary tap-feedback" onClick={handleShuffle}>
            <StudioIcon name="heart" size={18} /> Shuffle again
          </button>
        </footer>
      </div>
    </div>
  );
}
