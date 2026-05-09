import { useEffect, useRef, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import {
  setSnapshot,
  setConnected,
  updateAgent,
  updateQueue,
  addCall,
  updateCall,
  removeCall,
} from '../model/slice/callCenterSlice';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

/**
 * Hook that establishes an SSE (Server-Sent Events) connection
 * to the call center backend for real-time state updates.
 *
 * Uses the browser's native EventSource API:
 * - Zero dependencies (no socket.io-client)
 * - Built-in auto-reconnect
 * - Tenant-isolated on the backend via JWT
 *
 * Note: Native EventSource doesn't support custom headers,
 * so we pass the JWT token as a query parameter.
 * The backend should accept ?token= for SSE auth.
 */
export function useCallCenterSSE(enabled: boolean = true) {
  const dispatch = useDispatch();
  const esRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (!enabled) return;

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    // Close existing connection if any
    if (esRef.current) {
      esRef.current.close();
    }

    const url = `${API_BASE}/callcenter/events?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      dispatch(setConnected(true));
    };

    es.onerror = () => {
      dispatch(setConnected(false));
      // EventSource auto-reconnects, no manual handling needed
    };

    // ─── Event listeners ───────────────────────────────

    es.addEventListener('fullSnapshot', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        dispatch(setSnapshot(data));
        dispatch(setConnected(true));
      } catch { /* ignore parse errors */ }
    });

    es.addEventListener('agentUpdate', (e: MessageEvent) => {
      try {
        dispatch(updateAgent(JSON.parse(e.data)));
      } catch { /* ignore */ }
    });

    es.addEventListener('queueUpdate', (e: MessageEvent) => {
      try {
        dispatch(updateQueue(JSON.parse(e.data)));
      } catch { /* ignore */ }
    });

    es.addEventListener('callNew', (e: MessageEvent) => {
      try {
        dispatch(addCall(JSON.parse(e.data)));
      } catch { /* ignore */ }
    });

    es.addEventListener('callUpdate', (e: MessageEvent) => {
      try {
        dispatch(updateCall(JSON.parse(e.data)));
      } catch { /* ignore */ }
    });

    es.addEventListener('callAnswer', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        dispatch(updateCall({ uniqueid: data.uniqueid, status: 'TALKING', agent: data.agent }));
      } catch { /* ignore */ }
    });

    es.addEventListener('callEnd', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        dispatch(removeCall(data.uniqueid));
      } catch { /* ignore */ }
    });

    es.addEventListener('callAbandon', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        dispatch(removeCall(data.uniqueid));
      } catch { /* ignore */ }
    });

    // Hold / Unhold events — update call status in real-time
    es.addEventListener('callHold', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        dispatch(updateCall({ uniqueid: data.uniqueid, status: 'HOLD' }));
      } catch { /* ignore */ }
    });

    es.addEventListener('callUnhold', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        dispatch(updateCall({ uniqueid: data.uniqueid, status: 'TALKING' }));
      } catch { /* ignore */ }
    });

    // Wrapup events — update agent status
    es.addEventListener('wrapupStart', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        dispatch(updateAgent({ interface: data.agent, status: 'WRAPUP' }));
      } catch { /* ignore */ }
    });

    es.addEventListener('wrapupEnd', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        dispatch(updateAgent({ interface: data.agent, status: 'READY' }));
      } catch { /* ignore */ }
    });

    // Heartbeat — no action needed, just keeps SSE alive
    es.addEventListener('heartbeat', () => {
      // noop — prevents proxy timeout
    });
  }, [enabled, dispatch]);

  useEffect(() => {
    connect();

    return () => {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      dispatch(setConnected(false));
    };
  }, [connect, dispatch]);

  /** Force reconnect (e.g. after token refresh) */
  const reconnect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
    }
    connect();
  }, [connect]);

  return { reconnect };
}
