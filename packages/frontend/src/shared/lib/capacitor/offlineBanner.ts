import { useEffect, useState, useCallback } from 'react';
import { App } from '@capacitor/app';
import { isNativePlatform } from './isNative';

/** Current online flag from navigator (D-35 — banner only, no action queue). */
export function getOnlineStatus(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

/**
 * Subscribe to browser online/offline (+ Cap app resume refresh on native).
 * Returns unsubscribe. No offline action queue.
 */
export function subscribeOnlineStatus(
  listener: (online: boolean) => void,
): () => void {
  const onOnline = () => listener(true);
  const onOffline = () => listener(false);

  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);

  let removeAppListener: (() => void) | undefined;
  if (isNativePlatform()) {
    void App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) listener(getOnlineStatus());
    }).then((handle) => {
      removeAppListener = () => {
        void handle.remove();
      };
    });
  }

  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    removeAppListener?.();
  };
}

/** Hook for ModuleShell chrome: offline banner + retry. */
export function useOfflineBanner() {
  const [online, setOnline] = useState(getOnlineStatus);

  useEffect(() => subscribeOnlineStatus(setOnline), []);

  const retry = useCallback(() => {
    setOnline(getOnlineStatus());
  }, []);

  return {
    online,
    offline: !online,
    retry,
  };
}
