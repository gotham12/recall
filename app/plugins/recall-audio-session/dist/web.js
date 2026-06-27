export class RecallAudioSessionWeb {
  async prepareForSpeechRecognition() {
    /* Web — no native session */
  }

  async prepareForPlayback() {
    /* Web — no native session */
  }

  async releaseAudioSession() {
    /* Web — no native session */
  }

  async isScreenCaptured() {
    return { captured: false };
  }
}
