import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type FamiliarFace } from '../db/db';
import { useAppStore } from '../store/appStore';
import { buildMemorySlides, shuffleSlides, type MemorySlide } from '../lib/memoryRecap';
import { LOGIN_HERO } from '../lib/assets';
import { speak, stopSpeaking, unlockAudioPlayback } from '../services/elevenlabs';
import StudioIcon from './StudioIcon';

const FALLBACK_PHOTO = LOGIN_HERO.margaretProfile;
const AUTO_ADVANCE_MS = 5500;
const SPEAK_TIMEOUT_MS = 8000;
const PHOTO_LOAD_TIMEOUT_MS = 6000;

function preloadPhoto(url: string, cache: Set<string>): void {
  if (!url || cache.has(url)) return;
  cache.add(url);
  const img = new Image();
  img.src = url;
}

function waitForPhoto(url: string, timeoutMs = PHOTO_LOAD_TIMEOUT_MS): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(ok);
    };
    const timer = window.setTimeout(() => finish(false), timeoutMs);
    img.onload = () => finish(true);
    img.onerror = () => finish(false);
    img.src = url;
  });
}

function waitMs(ms: number, session: number, sessionRef: RefObject<number>): Promise<boolean> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(session === sessionRef.current), ms);
  });
}

function speakWithTimeout(text: string): Promise<void> {
  return Promise.race([
    speak(text, { warm: true }),
    new Promise<void>((resolve) => setTimeout(resolve, SPEAK_TIMEOUT_MS)),
  ]);
}

export default function MemoryPhotoRecap() {
  const { user, memoryRecapActive, memoryRecapReason, dismissMemoryRecap } = useAppStore();
  const [slides, setSlides] = useState<MemorySlide[]>([]);
  const [index, setIndex] = useState(0);
  const [failedSlideId, setFailedSlideId] = useState<string | null>(null);
  const sessionRef = useRef(0);
  const loadGenRef = useRef(0);
  const slidesRef = useRef<MemorySlide[]>([]);
  const loopRunningRef = useRef(false);
  const facesFingerprintRef = useRef('');
  const wasActiveRef = useRef(false);
  const preloadCacheRef = useRef(new Set<string>());

  const faces = useLiveQuery<FamiliarFace[]>(
    () => (user?.id ? db.familiarFaces.where('userId').equals(user.id).toArray() : []),
    [user?.id]
  ) ?? [];

  const facesRef = useRef(faces);
  facesRef.current = faces;

  const cancelRecap = useCallback(() => {
    sessionRef.current += 1;
    loadGenRef.current += 1;
    loopRunningRef.current = false;
    stopSpeaking();
  }, []);

  const showSlide = useCallback((idx: number) => {
    const list = slidesRef.current;
    const slide = list[idx];
    if (!slide) return;
    loadGenRef.current += 1;
    setIndex(idx);
    setFailedSlideId(null);
  }, []);

  const playSlideAt = useCallback(async (idx: number, session: number, autoAdvance: boolean) => {
    const list = slidesRef.current;
    const slide = list[idx];
    if (!slide || session !== sessionRef.current) return;

    showSlide(idx);

    const loaded = await waitForPhoto(slide.photoUrl);
    if (session !== sessionRef.current) return;
    if (!loaded) setFailedSlideId(slide.id);

    const loadGen = loadGenRef.current;
    void (async () => {
      try {
        unlockAudioPlayback();
        await speakWithTimeout(slide.speakText);
      } catch (err) {
        console.error(err);
      }
      if (loadGen !== loadGenRef.current || session !== sessionRef.current) return;
    })();

    if (!autoAdvance || list.length <= 1) return;

    const stillActive = await waitMs(AUTO_ADVANCE_MS, session, sessionRef);
    if (!stillActive || session !== sessionRef.current) return;

    await playSlideAt((idx + 1) % list.length, session, true);
  }, [showSlide]);

  const runRecapLoop = useCallback(async (session: number, startIdx = 0) => {
    loopRunningRef.current = true;
    try {
      await playSlideAt(startIdx, session, true);
    } finally {
      if (session === sessionRef.current) {
        loopRunningRef.current = false;
      }
    }
  }, [playSlideAt]);

  const startRecap = useCallback((reshuffle = false) => {
    if (!user) return;
    cancelRecap();
    const session = sessionRef.current;

    let album = buildMemorySlides(user, facesRef.current);
    if (reshuffle) {
      album = shuffleSlides(album);
    }

    slidesRef.current = album;
    setSlides(album);
    setIndex(0);
    setFailedSlideId(null);
    album.forEach((s) => preloadPhoto(s.photoUrl, preloadCacheRef.current));
    preloadPhoto(FALLBACK_PHOTO, preloadCacheRef.current);

    if (album.length === 0) {
      dismissMemoryRecap();
      return;
    }

    void runRecapLoop(session, 0);
  }, [user, cancelRecap, runRecapLoop, dismissMemoryRecap]);

  const startRecapRef = useRef(startRecap);
  startRecapRef.current = startRecap;

  useEffect(() => {
    if (!memoryRecapActive || !user) {
      if (!memoryRecapActive) {
        cancelRecap();
        slidesRef.current = [];
        setSlides([]);
        setIndex(0);
        setFailedSlideId(null);
      }
      wasActiveRef.current = false;
      return;
    }

    const justOpened = !wasActiveRef.current;
    wasActiveRef.current = true;

    if (justOpened) {
      startRecapRef.current(true);
      return;
    }

    const fingerprint = faces.map((f) => `${f.id ?? ''}:${f.photoUrl}`).join('|');
    if (fingerprint !== facesFingerprintRef.current) {
      facesFingerprintRef.current = fingerprint;
      startRecapRef.current(false);
    } else if (slidesRef.current.length === 0) {
      startRecapRef.current(false);
    }
  }, [memoryRecapActive, user?.id, faces, cancelRecap]);

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
    showSlide(next);
    void runRecapLoop(session, next);
  };

  const handleShuffle = () => {
    startRecap(true);
  };

  const handleImgError = (slideId: string) => {
    setFailedSlideId((prev) => (prev === slideId ? prev : slideId));
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
  const photoSrc = failedSlideId === slide.id ? FALLBACK_PHOTO : slide.photoUrl;
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
                : memoryRecapReason === 'identity'
                  ? 'Clara is helping you remember who you are'
                  : memoryRecapReason === 'disorientation'
                    ? 'Clara is here to ground you'
                    : 'Family Memory Recap™'}
            </p>
            <h2 className="memory-recap__title">{firstName}, you are so loved</h2>
          </div>
          <button type="button" className="studio-icon-btn tap-feedback" onClick={handleClose} aria-label="Close">
            <StudioIcon name="close" size={20} />
          </button>
        </header>

        <div className="memory-recap__stage">
          <div className="memory-recap__photo-wrap">
            <img
              key={`${slide.id}-${photoSrc}`}
              src={photoSrc}
              alt={slide.caption}
              className="memory-recap__photo memory-recap__photo--enter"
              loading="eager"
              decoding="async"
              fetchPriority="high"
              onError={() => handleImgError(slide.id)}
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
