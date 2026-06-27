export interface RecallAudioSessionPlugin {
  prepareForSpeechRecognition(): Promise<void>;
  prepareForPlayback(): Promise<void>;
  releaseAudioSession(): Promise<void>;
  isScreenCaptured(): Promise<{ captured: boolean }>;
}

export declare const RecallAudioSession: RecallAudioSessionPlugin;
