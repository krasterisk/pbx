import { useEffect, useState } from 'react';
import type { IAutodialMonitorHealth } from '@krasterisk/shared';
import {
  emptyAutodialLiveState,
  reduceAutodialEvent,
  type AutodialLiveState,
  type AutodialSseEvent,
} from './autodialLiveState';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const EVENT_TYPES: AutodialSseEvent['type'][] = [
  'snapshot',
  'channel_started',
  'channel_answered',
  'channel_ended',
  'campaign_stats',
  'pacer',
  'channel_step',
];

export type AutodialSseStatus = 'connecting' | 'open' | 'disconnected';

export interface UseAutodialSseResult extends AutodialLiveState {
  status: AutodialSseStatus;
  health?: IAutodialMonitorHealth;
  healthError?: boolean;
  snapshotReceivedAt?: number;
  recent?: Array<{ at: string; type: string; campaignUid: number; disposition?: string }>;
}

/**
 * Live dialer state over SSE. EventSource reconnects on its own, so the hook
 * only reports whether the stream is currently up — a `disconnected` badge is
 * what tells an operator the numbers on screen have stopped moving.
 */
export function useAutodialSse(enabled = true): UseAutodialSseResult {
  const [live, setLive] = useState<AutodialLiveState>(emptyAutodialLiveState);
  const [status, setStatus] = useState<AutodialSseStatus>('connecting');
  const [health, setHealth] = useState<IAutodialMonitorHealth>();
  const [healthError, setHealthError] = useState(false);
  const [snapshotReceivedAt, setSnapshotReceivedAt] = useState<number>();
  const [recent, setRecent] = useState<NonNullable<UseAutodialSseResult['recent']>>([]);

  useEffect(() => {
    if (!enabled) {
      setLive(emptyAutodialLiveState);
      setSnapshotReceivedAt(undefined);
      setStatus('disconnected');
      return undefined;
    }
    // EventSource cannot set headers, so the JWT rides in the query string —
    // JwtStrategy accepts ?token= for exactly this reason.
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setStatus('disconnected');
      return undefined;
    }

    setStatus('connecting');
    const es = new EventSource(
      `${API_BASE}/autodial/events?token=${encodeURIComponent(token)}`,
    );

    es.onopen = () => setStatus('open');
    es.onerror = () => setStatus('disconnected');

    const handle = (e: MessageEvent) => {
      let event: AutodialSseEvent;
      try {
        event = JSON.parse(e.data) as AutodialSseEvent;
      } catch {
        return;
      }
      setStatus('open');
      if (event.type === 'snapshot') setSnapshotReceivedAt(Date.now());
      setLive((prev) => reduceAutodialEvent(prev, event));
      if (['channel_started', 'channel_answered', 'channel_ended'].includes(event.type)) {
        const campaignUid = 'campaignUid' in event ? event.campaignUid : 'channel' in event ? event.channel.campaignUid : 0;
        setRecent((rows) => [{ at: new Date().toISOString(), type: event.type, campaignUid,
          ...('disposition' in event ? { disposition: event.disposition } : {}) }, ...rows].slice(0, 50));
      }
    };
    const handleHealth = (event: MessageEvent) => { try { setHealth(JSON.parse(event.data).health); setHealthError(false); } catch { setHealthError(true); } };
    const handleHealthError = () => setHealthError(true);
    es.addEventListener('health', handleHealth as EventListener); es.addEventListener('health_error', handleHealthError);

    EVENT_TYPES.forEach((type) => es.addEventListener(type, handle as EventListener));

    return () => {
      EVENT_TYPES.forEach((type) => es.removeEventListener(type, handle as EventListener));
      es.close();
    };
  }, [enabled]);

  return { ...live, status, health, healthError, recent, snapshotReceivedAt };
}
