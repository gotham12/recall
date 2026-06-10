import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type FamiliarFace } from '../db/db';
import { useAppStore } from '../store/appStore';
import { buildMemorySlides, type MemorySlide } from '../lib/memoryRecap';
import { memoryPhotoUrl } from '../lib/memoryPhotos';
import { speak, stopSpeaking } from '../services/elevenlabs';
import StudioIcon from './StudioIcon';

const FALLBACK_PHOTO = memoryPhotoUrl('garden');

function waitMs(ms: number, session: number, sessionRef: RefObject<number>): Promise<boolean> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(session === sessionRef.current), ms);
  });
}

export default function MemoryPhotoRecap() {
  const { user, memoryRecapActive, memoryRecapReason, dismissMemoryRecap } = useAppStore();
  const [slides, setSlides] = useState<MemorySlide[]>([]);
  const [index, setIndex] = useState(0);
  const [imgSrc, setImgSrc] = useState('');
  const sessionRef = useRef(0);
  const slidesRef = useRef<MemorySlide[]>([]);
  const loopRunningRef = useRef(false);

  const faces = useLiveQuery<FamiliarFace[]>(
    () => (user?.id ? db.familiarFaces.where('userId').equals(user.id).toArray() : []),
    [user?.id]
  ) ?? [];

  const facesRef = useRef(faces);
  facesRef.current = faces;

  const cancelRecap = useCallback(() => {
    sessionRef.current += 1;
    loopRunningRef.current = false;
    stopSpeaking();
  }, []);

  const playSlideAt = useCallback(async (idx: number, session: number, autoAdvance: boolean) => {
    const list = slidesRef.current;
    const slide = list[idx];
    if (!slide || session !== sessionRef.current) return;

    setIndex(idx);
    setImgSrc(slide.photoUrl);

    if (session !== sessionRef.current) return;

    try {
      await speak(slide.speakText, { warm: true });
    } catch (err) {
      console.error(err);
    }

    if (session !== sessionRef.current || !autoAdvance || list.length <= 1) return;

    const stillActive = await waitMs(700, session, sessionRef);
    if (!stillActive || session !== sessionRef.current) return;

    await playSlideAt((idx + 1) % list.length, session, true);
  }, []);

  const runRecapLoop = useCallback(async (session: number, startIdx = 0) => {
    if (loopRunningRef.current && session === sessionRef.current) return;
    loopRunningRef.current = true;
    try {
      await playSlideAt(startIdx, session, true);
    } finally {
      if (session === sessionRef.current) {
        loopRunningRef.current = false;
      }
    }
  }, [playSlideAt]);

  const startRecap = useCallback(() => {
    if (!user) return;
    cancelRecap();
    const session = sessionRef.current;
    const album = buildMemorySlides(user, facesRef.current);
    slidesRef.current = album;
    setSlides(album);
    if (album.length === 0) return;
    void runRecapLoop(session, 0);
  }, [user, cancelRecap, runRecapLoop]);

  const startRecapRef = useRef(startRecap);
  startRecapRef.current = startRecap;

  useEffect(() => {
    if (memoryRecapActive && user) {
      startRecapRef.current();
    } else if (!memoryRecapActive) {
      cancelRecap();
      setSlides([]);
      setIndex(0);
      setImgSrc('');
    }
  }, [memoryRecapActive, user?.id, cancelRecap]);

  useEffect(() => () => cancelRecap(), [cancelRecap]);

  const handleClose = () => {
    cancelRecap();
    dismissMemoryRecap();
  };

  const handleNext = () => {
    const list = slidesRef.current;
    if (list.length === 0) return;
    cancelRecap();
    const session = sessionRef.current;
    const next = (index + 1) % list.length;
    void runRecapLoop(session, next);
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
