import { SplashScreen } from '@capacitor/splash-screen';

import { isNativePlatform } from './isNative';

/** Dismiss Android/iOS launch splash once the WebView is ready. */
export async function hideNativeSplash(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    await SplashScreen.hide();
  } catch {
    // Plugin missing / already hidden - ignore
  }
}
