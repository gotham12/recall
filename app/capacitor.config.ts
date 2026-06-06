import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.recall.app',
  appName: 'Recall',
  webDir: 'dist',
  server: {
    iosScheme: 'ionic',
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#F8F4EF',
  },
};

export default config;
