import { registerPlugin } from '@capacitor/core';

const RecallHealthkit = registerPlugin('RecallHealthkit', {
  web: () => import('./web.js').then((m) => new m.RecallHealthkitWeb()),
});

export { RecallHealthkit };
