import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { appBuildDefines } from './app-build-defines';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/modules/voice-robots/',
  define: { ...appBuildDefines(), 'import.meta.env.VITE_API_URL': JSON.stringify('/modules/voice-robots/api.php'),
    'import.meta.env.VITE_VPBX_STANDALONE': JSON.stringify('true') },
  resolve: { alias: { '@': path.resolve(__dirname, './src'), '@krasterisk/shared': path.resolve(__dirname, '../shared/src') } },
  build: { outDir: 'dist-mpbx-standalone', emptyOutDir: true, sourcemap: false,
    reportCompressedSize: false, rollupOptions: { input: path.resolve(__dirname, 'mpbx-standalone.html') } },
});
