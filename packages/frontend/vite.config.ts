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
    // Absolute base so Node/undici fetch (CI) accepts RTK relative paths.
    env: {
      VITE_API_URL: 'http://127.0.0.1/api',
    },
    // Constrain discovery to src — default globs hang at RUN on Windows while
    // walking Capacitor android/ios + workspace trees (zero files executed).
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.spec.ts', 'src/**/*.spec.tsx'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-*/**',
      '**/android/**',
      '**/ios/**',
      '**/.idea/**',
      '**/.vite/**',
      '**/.vite-temp/**',
    ],
    // Prefer threads on Windows: forks pool hangs at RUN before executing any file
    // when discovery is used (even with src-only include). Explicit file args still work with forks.
    pool: 'threads',
    maxWorkers: process.platform === 'win32' ? 1 : 2,
    fileParallelism: process.platform !== 'win32',
    isolate: true,
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/shared/config/tests/setupTests.ts',
    css: false,
  },
});
