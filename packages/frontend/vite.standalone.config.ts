/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { resolve } from 'path';

/**
 * Standalone build config for v3 integration.
 *
 * Differences from main vite.config.ts:
 * - base: '/voice-robots/' — assets are served from /voice-robots/assets/
 * - Single entry point: standalone.html only
 * - Output to dist-standalone/ to avoid overwriting main build
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/voice-robots/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist-standalone',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        standalone: resolve(__dirname, 'standalone.html'),
      },
    },
  },
});
