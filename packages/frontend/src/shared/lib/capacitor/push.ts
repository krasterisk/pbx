import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { isNativePlatform } from './isNative';

export type RegisterPushOptions = {
  /** API base including /api prefix (default: VITE_API_URL or /api). */
  apiBase?: string;
  /** Override platform label (default: Capacitor.getPlatform()). */
  platform?: string;
};

/**
 * FCM foundation: request permission → register → POST token (NAV-12 / D-32).
 * No-op on web. Does not build campaign UX.
 *
 * Requires `google-services.json` under android/app (gitignored) - see
 * packages/frontend/docs/ANDROID_WEBRTC_NOTES.md / Firebase setup.
 */
export async function registerPush(
  accessToken: string,
  options: RegisterPushOptions = {},
): Promise<void> {
  if (!isNativePlatform()) {
    return;
  }
  if (!accessToken) {
    return;
  }

  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== 'granted') {
    return;
  }

  const apiBase = (options.apiBase ?? import.meta.env.VITE_API_URL ?? '/api').replace(
    /\/$/,
    '',
  );
  const platform = options.platform ?? Capacitor.getPlatform();

  await PushNotifications.addListener('registration', ({ value }) => {
    void postDeviceToken(apiBase, accessToken, value, platform);
  });

  await PushNotifications.addListener('registrationError', () => {
    // Intentionally quiet - do not log token-related errors with secrets
  });

  await PushNotifications.register();
}

async function postDeviceToken(
  apiBase: string,
  accessToken: string,
  token: string,
  platform: string,
): Promise<void> {
  try {
    await fetch(`${apiBase}/marketplace/device-token`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, platform }),
    });
  } catch {
    // Non-blocking - login must succeed even if push register fails
  }
}
