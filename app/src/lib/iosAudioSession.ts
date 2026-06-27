import { Capacitor } from '@capacitor/core';
import { RecallAudioSession } from 'recall-audio-session';

export function isNativeIOS(): boolean {
  return Capacitor.getPlatform() === 'ios';
}

export function isIOSBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** Configure AVAudioSession so mic use can mix with screen recording where iOS allows. */
export async function prepareMicForScreenRecord(): Promise<void> {
  if (!isNativeIOS()) return;
  try {
    await RecallAudioSession.prepareForSpeechRecognition();
  } catch (err) {
    console.warn('[AudioSession] prepareForSpeechRecognition:', err);
  }
}

/** Playback category with mixWithOthers — Clara TTS should not hijack screen-record audio. */
export async function preparePlaybackForScreenRecord(): Promise<void> {
  if (!isNativeIOS()) return;
  try {
    await RecallAudioSession.prepareForPlayback();
  } catch (err) {
    console.warn('[AudioSession] prepareForPlayback:', err);
  }
}

/** Release mic so Control Center screen recording audio can resume. */
export async function releaseMicAfterClara(): Promise<void> {
  if (!isNativeIOS()) return;
  try {
    await RecallAudioSession.releaseAudioSession();
  } catch (err) {
    console.warn('[AudioSession] releaseAudioSession:', err);
  }
}

export async function isScreenRecordingActive(): Promise<boolean> {
  if (!isNativeIOS()) return false;
  try {
    const { captured } = await RecallAudioSession.isScreenCaptured();
    return captured;
  } catch {
    return false;
  }
}
