import { useEffect, useRef, useCallback } from 'react';
import { useStore, useSelector } from 'react-redux';
import type { RootState } from '@/app/store/store';
import { selectCurrentUser } from '@/entities/User';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { rtkApi } from '@/shared/api/rtkApi';
import { callCenterApi, type IOperatorHistoryRow } from '@/shared/api/endpoints/callCenterApi';
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
  const dispatch = useAppDispatch();
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
          ...(data.callerIdNum ? { callerIdNum: String(data.callerIdNum) } : {}),
          ...(data.callerIdName ? { callerIdName: String(data.callerIdName) } : {}),
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

    // Hold / Unhold events - update call status in real-time
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

    // Wrapup events - update agent status
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

    // KPI deltas (D-11/D-12/D-45) - patch shift + day counters for any agent
    // (status bar + Coworkers); invalidate RTK AgentKpi only for myself.
    es.addEventListener('agentKpiUpdate', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        const login = data?.kpi?.sinceLogin;
        const midnight = data?.kpi?.sinceMidnight;
        if (data?.agent && (login || midnight)) {
          const prev = store.getState().callCenter?.agents?.find(
            (a: { interface: string }) => a.interface === data.agent,
          );
          dispatch(updateAgent({
            interface: data.agent,
            ...(login
              ? {
                  // Never let a lagging KPI emit wipe a higher live counter
                  // (DialEnd bumps agent.callsMade before metrics emit).
                  callsTaken: Math.max(prev?.callsTaken ?? 0, login.answered ?? 0),
                  callsMade: Math.max(prev?.callsMade ?? 0, login.made ?? 0),
                  callsMissed: Math.max(prev?.callsMissed ?? 0, login.missed ?? 0),
                }
              : {}),
            ...(midnight
              ? {
                  kpiDay: {
                    answered: midnight.answered ?? 0,
                    made: midnight.made ?? 0,
                    missed: midnight.missed ?? 0,
                  },
                }
              : {}),
          }));
        }
        const myIface = store.getState().callCenter?.myAgentInterface;
        if (myIface && data.agent === myIface) {
          dispatch(rtkApi.util.invalidateTags(['AgentKpi']));
        }
      } catch { /* ignore */ }
    });

    // Missed calls - broadcast on window so the MissedCallsPanel invalidates its cache
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

    // Presence (D-36/D-37/D-45) - a single BLF dot changed. Patch the cached
    // unfiltered getTransferDirectory entry in place (no refetch, no full-list
    // rebroadcast) so TransferDirectory's directory list updates live without
    // re-hitting the server. Search-filtered cache entries (a distinct RTK
    // Query cache key) are not patched here - they refresh on their own next
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

    // Journal live prepend (D-05) - own rows only; keep up to the API fetch cap
    // (200) so SoftphoneJournal "Show more" can still page through older rows.
    es.addEventListener('historyRow', (e: MessageEvent) => {
      try {
        const row = JSON.parse(e.data) as {
          uid?: number;
          callerIdNum?: string;
          callerIdName?: string;
          direction?: IOperatorHistoryRow['direction'];
          disposition?: IOperatorHistoryRow['disposition'];
          agentUserUid?: number;
          createdAt?: string;
          callUniqueid?: string;
          queueName?: string | null;
          transferDestination?: string | null;
        };
        const myId = selectCurrentUser(store.getState())?.uniqueid;
        if (myId == null || row.agentUserUid == null || Number(row.agentUserUid) !== Number(myId)) {
          return;
        }
        const mapped: IOperatorHistoryRow = {
          uid: Number(row.uid ?? 0),
          callUniqueid: String(row.callUniqueid ?? ''),
          queueName: row.queueName ?? null,
          callerIdNum: String(row.callerIdNum ?? ''),
          callerIdName: String(row.callerIdName ?? ''),
          direction: row.direction ?? 'inbound',
          callType: null,
          disposition: row.disposition ?? 'other',
          transferDestination: row.transferDestination ?? null,
          handledByName: null,
          handledByExten: null,
          enterTime: null,
          answerTime: null,
          endTime: row.createdAt ?? null,
          waitTime: null,
          talkTime: null,
        };
        const prepend = (draft: IOperatorHistoryRow[] | undefined) => {
          if (!draft) return;
          if (mapped.uid && draft.some((r) => r.uid === mapped.uid)) return;
          if (
            mapped.callUniqueid
            && draft.some((r) => r.callUniqueid && r.callUniqueid === mapped.callUniqueid)
          ) {
            return;
          }
          draft.unshift(mapped);
          while (draft.length > 200) draft.pop();
        };
        // Patch every subscribed period cache (shift / day / default void → day).
        for (const arg of [{ period: 'shift' as const }, { period: 'day' as const }, undefined]) {
          dispatch(
            callCenterApi.util.updateQueryData('getOperatorCallHistory', arg, prepend),
          );
        }
      } catch { /* ignore */ }
    });

    // Parked calls (D-28/D-45) - any operator's park/retrieve invalidates
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

    // Heartbeat - no action needed, just keeps SSE alive
    es.addEventListener('heartbeat', () => {
      // noop - prevents proxy timeout
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

  // Auth may load after first fullSnapshot - retry bind when userId appears
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
