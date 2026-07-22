import { useEffect, useRef, useCallback } from 'react';
import { useDispatch, useStore, useSelector } from 'react-redux';
import type { RootState } from '@/app/store/store';
import { selectCurrentUser } from '@/entities/User';
import { rtkApi } from '@/shared/api/rtkApi';
import { callCenterApi } from '@/shared/api/endpoints/callCenterApi';
import {
  setSnapshot,
  setConnected,
  setMyAgentInterface,
  updateAgent,
  updateQueue,
  addCall,
  updateCall,
  removeCall,
  chatMessageReceived,
} from '../model/slice/callCenterSlice';
import type { IAgent } from '../model/types/callCenterSchema';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

/**
 * Fallback: if login did not bind myAgentInterface, bind from SSE when an
 * agent with matching userId is present and not OFFLINE. Never overwrites.
 */
function maybeBindMyAgentInterface(
  getState: () => RootState,
  dispatch: (action: ReturnType<typeof setMyAgentInterface>) => void,
  agents: Array<Pick<IAgent, 'interface' | 'userId' | 'status'>>,
) {
  const state = getState();
  if (state.callCenter?.myAgentInterface) return;
  const userId = selectCurrentUser(state)?.uniqueid;
  if (userId == null) return;
  const match = agents.find(
    (a) => a.userId === userId && a.status !== 'OFFLINE' && a.interface,
  );
  if (match) {
    dispatch(setMyAgentInterface(match.interface));
  }
}

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
  const store = useStore<RootState>();
  const esRef = useRef<EventSource | null>(null);
  const currentUserId = useSelector(selectCurrentUser)?.uniqueid;

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
        maybeBindMyAgentInterface(store.getState, dispatch, data.agents ?? []);
      } catch { /* ignore parse errors */ }
    });

    es.addEventListener('agentUpdate', (e: MessageEvent) => {
      try {
        const agent = JSON.parse(e.data) as IAgent & { removed?: boolean };
        dispatch(updateAgent(agent));
        const fromStore = store.getState().callCenter?.agents ?? [];
        const agents = fromStore.some((a) => a.interface === agent.interface)
          ? fromStore
          : [...fromStore, agent];
        maybeBindMyAgentInterface(store.getState, dispatch, agents);
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
        dispatch(updateCall({
          uniqueid: data.uniqueid,
          status: 'TALKING',
          agent: data.agent,
          queue: data.queue,
        }));
      } catch { /* ignore */ }
    });

    es.addEventListener('callEnd', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        dispatch(removeCall(data.uniqueid));
        // Uniqueid mismatch fallback: drop WAITING twin by caller channel
        if (data.callerChannel) {
          const calls = store.getState().callCenter?.calls ?? [];
          for (const c of calls) {
            if (
              c.uniqueid !== data.uniqueid
              && c.callerChannel === data.callerChannel
              && (c.status === 'WAITING' || c.status === 'RINGING')
            ) {
              dispatch(removeCall(c.uniqueid));
            }
          }
        }
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
        window.dispatchEvent(new CustomEvent('cc:wrapup-start', { detail: data }));
      } catch { /* ignore */ }
    });

    es.addEventListener('wrapupExtend', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        window.dispatchEvent(new CustomEvent('cc:wrapup-extend', { detail: data }));
      } catch { /* ignore */ }
    });

    es.addEventListener('wrapupEnd', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        dispatch(updateAgent({ interface: data.agent, status: 'READY' }));
        window.dispatchEvent(new CustomEvent('cc:wrapup-end', { detail: data }));
      } catch { /* ignore */ }
    });

    // KPI deltas (D-11/D-12/D-45) — invalidate only when the update is for this
    // agent; the SSE stream is tenant-wide, not per-agent, so a coworker's KPI
    // change must never trigger a refetch of my own status-bar counters.
    es.addEventListener('agentKpiUpdate', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        const myIface = store.getState().callCenter?.myAgentInterface;
        if (myIface && data.agent === myIface) {
          dispatch(rtkApi.util.invalidateTags(['AgentKpi']));
        }
      } catch { /* ignore */ }
    });

    // Missed calls — broadcast on window so the MissedCallsPanel invalidates its cache
    es.addEventListener('missedCallNew', (e: MessageEvent) => {
      try {
        window.dispatchEvent(new CustomEvent('cc:missed-call-new', { detail: JSON.parse(e.data) }));
      } catch { /* ignore */ }
    });
    es.addEventListener('missedCallUpdate', (e: MessageEvent) => {
      try {
        window.dispatchEvent(new CustomEvent('cc:missed-call-update', { detail: JSON.parse(e.data) }));
      } catch { /* ignore */ }
    });

    // Presence (D-36/D-37/D-45) — a single BLF dot changed. Patch the cached
    // unfiltered getTransferDirectory entry in place (no refetch, no full-list
    // rebroadcast) so TransferDirectory's directory list updates live without
    // re-hitting the server. Search-filtered cache entries (a distinct RTK
    // Query cache key) are not patched here — they refresh on their own next
    // fetch, a documented scope limit rather than a silent gap.
    es.addEventListener('presenceUpdate', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as { extension?: string; state?: string };
        if (!data?.extension) return;
        dispatch(
          callCenterApi.util.updateQueryData('getTransferDirectory', undefined, (draft) => {
            const entry = draft.endpoints.find((ep) => ep.extension === data.extension);
            if (entry) entry.presence = data.state || entry.presence;
          }),
        );
      } catch { /* ignore */ }
    });

    // Parked calls (D-28/D-45) — any operator's park/retrieve invalidates
    // everyone's ParkedCallsIndicator list. Zombie-candidate flags need no
    // dedicated listener: they ride the existing callUpdate merge above
    // (CallState.zombieCandidate -> ICall.zombieCandidate).
    es.addEventListener('parkedCallsUpdate', () => {
      dispatch(rtkApi.util.invalidateTags(['ParkedCalls']));
    });

    es.addEventListener('ccChatMessage', (e: MessageEvent) => {
      try {
        const detail = JSON.parse(e.data);
        dispatch(chatMessageReceived(detail));
        window.dispatchEvent(new CustomEvent('cc:chat-message', { detail }));
      } catch { /* ignore */ }
    });

    // Heartbeat — no action needed, just keeps SSE alive
    es.addEventListener('heartbeat', () => {
      // noop — prevents proxy timeout
    });
  }, [enabled, dispatch, store]);

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

  // Auth may load after first fullSnapshot — retry bind when userId appears
  useEffect(() => {
    if (!enabled || currentUserId == null) return;
    maybeBindMyAgentInterface(
      store.getState,
      dispatch,
      store.getState().callCenter?.agents ?? [],
    );
  }, [enabled, currentUserId, dispatch, store]);

  /** Force reconnect (e.g. after token refresh) */
  const reconnect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
    }
    connect();
  }, [connect]);

  return { reconnect };
}
