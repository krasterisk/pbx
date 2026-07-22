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
  // Dev/smoke: WebView defaults to https://localhost and blocks http://LAN API (mixed content).
  // Production should use HTTPS API — then remove cleartext / allowMixedContent.
  server: {
    androidScheme: 'http',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 300,
      backgroundColor: '#0c1214',
    },
  },
};

export default config;
