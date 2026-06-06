import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/recall/',
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          recharts: ['recharts'],
          dexie: ['dexie', 'dexie-react-hooks'],
        },
      },
    },
  },
  server: {
    port: 3000,
    host: true,
  },
});
