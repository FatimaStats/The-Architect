import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `npm run build` → dist/
// `npm run build:single` → dist-artifact/the-architect.html (one self-contained page)
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { chunkSizeWarningLimit: 1200 },
});
