/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const configDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(configDirectory, './src'),
      // Backend uses shared/dist (CJS); Vite must use TS source for named ESM exports
      '@krasterisk/shared': path.resolve(configDirectory, '../shared/src'),
    },
  },
  define: {
    // @react-pdf/renderer needs process.env
    'process.env': {},
    'process.browser': true,
  },
  optimizeDeps: {
    // Pre-bundle react-pdf to avoid ESM/CJS issues in dev
    include: ['@react-pdf/renderer'],
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(configDirectory, 'index.html'),
      },
    },
  },
  server: {
    port: 3010,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:5010',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5010',
        ws: true,
      },
    },
  },
  test: {
    // Windows: one fork avoids the previous vitest hang at RUN with zero files.
    pool: process.platform === 'win32' ? 'forks' : 'threads',
    maxWorkers: process.platform === 'win32' ? 1 : 2,
    fileParallelism: process.platform !== 'win32',
    isolate: true,
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/shared/config/tests/setupTests.ts',
    css: false,
  },
});
