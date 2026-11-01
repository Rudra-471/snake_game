import { defineConfig } from 'vite';

export default defineConfig({
  server: { host: true, open: false },
  build: { chunkSizeWarningLimit: 1200 },
});
