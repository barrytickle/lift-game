import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // relative paths so dist/ can be hosted from any folder (itch.io, GitHub Pages)
  build: {
    chunkSizeWarningLimit: 1600, // Phaser alone is ~1.2 MB minified
  },
});
