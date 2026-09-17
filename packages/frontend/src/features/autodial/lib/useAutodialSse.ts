import { useEffect, useState } from 'react';
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
];

export type AutodialSseStatus = 'connecting' | 'open' | 'disconnected';

export interface UseAutodialSseResult extends AutodialLiveState {
  status: AutodialSseStatus;
}

/**
 * Live dialer state over SSE. EventSource reconnects on its own, so the hook
 * only reports whether the stream is currently up — a `disconnected` badge is
 * what tells an operator the numbers on screen have stopped moving.
 */
export function useAutodialSse(enabled = true): UseAutodialSseResult {
  const [live, setLive] = useState<AutodialLiveState>(emptyAutodialLiveState);
  const [status, setStatus] = useState<AutodialSseStatus>('connecting');

  useEffect(() => {
    if (!enabled) {
      setLive(emptyAutodialLiveState);
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
      setLive((prev) => reduceAutodialEvent(prev, event));
    };

    EVENT_TYPES.forEach((type) => es.addEventListener(type, handle as EventListener));

    return () => {
      EVENT_TYPES.forEach((type) => es.removeEventListener(type, handle as EventListener));
      es.close();
    };
  }, [enabled]);

  return { ...live, status };
}
