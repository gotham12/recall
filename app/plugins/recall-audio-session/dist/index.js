import { registerPlugin } from '@capacitor/core';

const RecallAudioSession = registerPlugin('RecallAudioSession', {
  web: () => import('./web.js').then((m) => new m.RecallAudioSessionWeb()),
});

export { RecallAudioSession };
