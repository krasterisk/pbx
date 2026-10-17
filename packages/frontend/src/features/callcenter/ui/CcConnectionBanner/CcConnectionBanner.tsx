import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { WifiOff } from 'lucide-react';
import { HStack, Text } from '@/shared/ui';
import type { RootState } from '@/app/store/store';
import styles from './CcConnectionBanner.module.scss';

export type CcConnectionDataState = 'live' | 'stale' | 'offline';

export interface CcConnectionCheckInput {
  connected: boolean;
  lastEventAt: number | null;
  disconnectedSince: number | null;
  mountedAt: number;
  nowMs: number;
  disconnectGraceSec?: number;
  staleAfterSec?: number;
}

export function resolveCcConnectionState({
  connected,
  lastEventAt,
  disconnectedSince,
  mountedAt,
  nowMs,
  disconnectGraceSec = 10,
  staleAfterSec = 45,
}: CcConnectionCheckInput): CcConnectionDataState {
  if (!connected) {
    const since = disconnectedSince ?? mountedAt;
    if (nowMs - since >= disconnectGraceSec * 1000) {
      return 'offline';
    }
    return 'live';
  }
  if (lastEventAt != null && nowMs - lastEventAt >= staleAfterSec * 1000) {
    return 'stale';
  }
  return 'live';
}

function formatClockHms(epochMs: number): string {
  const d = new Date(epochMs);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export function useCcConnectionHealth(options?: {
  disconnectGraceSec?: number;
  staleAfterSec?: number;
}): {
  state: CcConnectionDataState;
  isDegraded: boolean;
  lastEventAt: number | null;
} {
  const connected = useSelector((s: RootState) => s.callCenter?.connected ?? true);
  const lastEventAt = useSelector((s: RootState) => s.callCenter?.lastEventAt ?? null);
  const disconnectedSince = useSelector((s: RootState) => s.callCenter?.disconnectedSince ?? null);
  const mountedAtRef = useRef<number>(Date.now());
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    setNowMs(Date.now());
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, [connected, lastEventAt, disconnectedSince]);

  const state = resolveCcConnectionState({
    connected,
    lastEventAt,
    disconnectedSince,
    mountedAt: mountedAtRef.current,
    nowMs,
    disconnectGraceSec: options?.disconnectGraceSec,
    staleAfterSec: options?.staleAfterSec,
  });

  return {
    state,
    isDegraded: state !== 'live',
    lastEventAt,
  };
}

export interface CcConnectionBannerProps {
  disconnectGraceSec?: number;
  staleAfterSec?: number;
}

/**
 * Sticky warning when the event stream is down (> 10s) or has delivered
 * nothing for 45s — three missed heartbeats, not a quiet queue (U0.4).
 */
export function CcConnectionBanner({
  disconnectGraceSec = 10,
  staleAfterSec = 45,
}: CcConnectionBannerProps = {}) {
  const { t } = useTranslation();
  const { state, isDegraded, lastEventAt } = useCcConnectionHealth({
    disconnectGraceSec,
    staleAfterSec,
  });

  if (!isDegraded) return null;

  const time = lastEventAt != null ? formatClockHms(lastEventAt) : null;
  const message = state === 'offline'
    ? (time
      ? t('callcenter.connectionBanner.offlineSince', {
          defaultValue: 'Since {{time}} a new call may not show up on this page. Wait, it is reconnecting.',
          time,
        })
      : t(
          'callcenter.connectionBanner.reconnecting',
          'A new call may not show up on this page. Wait, it is reconnecting.',
        ))
    : t('callcenter.connectionBanner.staleSince', {
        defaultValue: 'Since {{time}} the waiting list on this page may be out of date.',
        time: time ?? '',
      });

  return (
    <HStack
      gap="8"
      align="center"
      role="alert"
      className={styles.banner}
      data-testid="cc-connection-banner"
    >
      <WifiOff size={16} className={styles.icon} aria-hidden="true" />
      <Text as="span" className={styles.text}>
        {message}
      </Text>
    </HStack>
  );
}
