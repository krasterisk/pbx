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
 * SSE hook for the public TV wallboard (D-29).
 *
 * Token comes ONLY from the URL query (?token=) via the page argument —
 * never from localStorage / JWT. Connects to read-only
 * /callcenter/wallboard/events under DisplayTokenGuard.
 */
export function useWallboardSSE(token: string | null, enabled = true) {
  const dispatch = useDispatch();
  const esRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (!enabled || !token) {
      dispatch(setConnected(false));
      return;
    }

    if (esRef.current) {
      esRef.current.close();
    }

    const url = `${API_BASE}/callcenter/wallboard/events?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      dispatch(setConnected(true));
    };

    es.onerror = () => {
      dispatch(setConnected(false));
    };

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

    es.addEventListener('heartbeat', () => {
      // noop — keeps SSE alive through proxies
    });
  }, [token, enabled, dispatch]);

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

  const reconnect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
    }
    connect();
  }, [connect]);

  return { reconnect };
}
