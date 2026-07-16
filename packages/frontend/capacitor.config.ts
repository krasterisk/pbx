import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor 8 config (NAV-10 / D-30 / D-37).
 * Requires Node.js 22+ and Android Studio ≥ 2025.2.1 for native builds.
 * Vite outDir is `dist` → webDir must match.
 */
const config: CapacitorConfig = {
  appId: 'com.krasterisk.app',
  appName: 'Krasterisk',
  webDir: 'dist',
};

export default config;
