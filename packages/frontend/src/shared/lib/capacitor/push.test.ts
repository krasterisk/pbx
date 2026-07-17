import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  requestPermissions,
  register,
  addListener,
} = vi.hoisted(() => ({
  requestPermissions: vi.fn(),
  register: vi.fn(),
  addListener: vi.fn(),
}));

vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: {
    requestPermissions,
    register,
    addListener,
  },
}));

vi.mock('./isNative', () => ({
  isNativePlatform: vi.fn(),
}));

import { isNativePlatform } from './isNative';
import { registerPush } from './push';

describe('registerPush (NAV-12 / D-32)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
  });

  it('no-ops on web (does not call PushNotifications)', async () => {
    vi.mocked(isNativePlatform).mockReturnValue(false);

    await registerPush('jwt-token');

    expect(requestPermissions).not.toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('requests permissions, registers, and POSTs token on registration', async () => {
    vi.mocked(isNativePlatform).mockReturnValue(true);
    requestPermissions.mockResolvedValue({ receive: 'granted' });
    register.mockResolvedValue(undefined);
    addListener.mockImplementation((event: string, cb: (p: { value: string }) => void) => {
      if (event === 'registration') {
        cb({ value: 'fcm-token-xyz' });
      }
      return Promise.resolve({ remove: vi.fn() });
    });

    await registerPush('access-jwt', {
      apiBase: '/api',
      platform: 'android',
    });

    expect(requestPermissions).toHaveBeenCalled();
    expect(register).toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(
      '/api/marketplace/device-token',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer access-jwt',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ token: 'fcm-token-xyz', platform: 'android' }),
      }),
    );
  });

  it('skips register when permission denied', async () => {
    vi.mocked(isNativePlatform).mockReturnValue(true);
    requestPermissions.mockResolvedValue({ receive: 'denied' });

    await registerPush('access-jwt');

    expect(register).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
