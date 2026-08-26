import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { isRawAgentName } from '@/features/callcenter/lib/displayLabels';
import type {
  CallCenterState,
  IAgent,
  IQueueStats,
  ICall,
  ICcSnapshot,
  IChatMessagePayload,
} from '../types/callCenterSchema';

const initialState: CallCenterState = {
  agents: [],
  queues: [],
  calls: [],
  connected: false,
  myAgentInterface: null,
  chatUnreadByChannel: {},
  chatOpen: false,
  pendingOutboundDial: null,
};

export const callCenterSlice = createSlice({
  name: 'callCenter',
  initialState,
  reducers: {
    // ─── Full snapshot (on SSE connect) ────────────────────
    setSnapshot(state, action: PayloadAction<ICcSnapshot>) {
      // Nest restart / AMI preload can briefly emit the operator with queues: []
      // while sessionStorage / prior bindIdentity still knows the shift queues -
      // wiping them empties QueuesTab + hides self in CoworkersTab.
      const prevMy = state.myAgentInterface
        ? state.agents.find((a) => a.interface === state.myAgentInterface)
        : undefined;
      const prevQueues = prevMy?.queues?.length ? prevMy.queues : null;

      state.agents = action.payload.agents;
      state.queues = action.payload.queues;
      state.calls = action.payload.calls;

      if (prevQueues && state.myAgentInterface) {
        const idx = state.agents.findIndex((a) => a.interface === state.myAgentInterface);
        if (idx >= 0 && !(state.agents[idx].queues?.length)) {
          state.agents[idx].queues = prevQueues;
        }
      }
    },

    setConnected(state, action: PayloadAction<boolean>) {
      state.connected = action.payload;
    },

    setMyAgentInterface(state, action: PayloadAction<string | null>) {
      state.myAgentInterface = action.payload;
    },

    // ─── Agent updates ────────────────────────────────────
    updateAgent(state, action: PayloadAction<Partial<IAgent> & {
      interface: string;
      removed?: boolean;
      pauseReason?: string | null;
      peerNumber?: string | null;
      dialTarget?: string | null;
    }>) {
      const data = action.payload;
      if (data.removed) {
        state.agents = state.agents.filter(a => a.interface !== data.interface);
        return;
      }
      const idx = state.agents.findIndex(a => a.interface === data.interface);
      if (idx >= 0) {
        const prev = state.agents[idx];
        // Do not let AMI/SSE replace a real display name with extension / PJSIP id
        // (Originate CallerID often echoes into QueueMember name).
        const merge = { ...data };
        if (
          merge.name
          && isRawAgentName(merge.name, merge.interface || prev.interface)
          && prev.name
          && !isRawAgentName(prev.name, prev.interface)
        ) {
          delete merge.name;
        }
        state.agents[idx] = { ...prev, ...merge };
        // Optimistic status flip without server stamp - start clock now until SSE arrives
        if (data.status && data.status !== prev.status && data.statusSince === undefined) {
          state.agents[idx].statusSince = new Date().toISOString();
        } else if (
          data.status
          && data.status === prev.status
          && prev.statusSince
          && data.statusSince
        ) {
          // Same status: keep the earlier stamp so a Nest restart / AMI reload
          // cannot shrink an overnight timer back to "hours since boot".
          const prevMs = Date.parse(prev.statusSince);
          const nextMs = Date.parse(String(data.statusSince));
          if (Number.isFinite(prevMs) && Number.isFinite(nextMs) && nextMs > prevMs) {
            state.agents[idx].statusSince = prev.statusSince;
          }
        }
        // SSE sends pauseReason: null when leaving pause modes (JSON omits undefined)
        const statusKeepsReason =
          data.status === 'PAUSED'
          || data.status === 'OUTBOUND_WORK'
          || data.status === 'DIALING';
        if (
          data.pauseReason === null
          || data.pauseReason === ''
          || (data.status && !statusKeepsReason)
        ) {
          delete state.agents[idx].pauseReason;
        }
        const statusKeepsPeer =
          data.status === 'RINGING'
          || data.status === 'IN_CALL'
          || data.status === 'DIALING'
          || data.status === 'CONSULT';
        if (
          data.peerNumber === null
          || data.peerNumber === ''
          || (data.status && !statusKeepsPeer)
        ) {
          delete state.agents[idx].peerNumber;
        }
        const statusKeepsDial =
          data.status === 'DIALING'
          || data.status === 'IN_CALL'
          || data.status === 'CONSULT';
        if (
          data.dialTarget === null
          || data.dialTarget === ''
          || (data.status && !statusKeepsDial)
        ) {
          delete state.agents[idx].dialTarget;
        }
      } else if (data.name && data.status) {
        // Only add as new agent if we have enough data
        const agent = { ...data } as IAgent;
        const statusKeepsReason =
          agent.status === 'PAUSED'
          || agent.status === 'OUTBOUND_WORK'
          || agent.status === 'DIALING';
        if (agent.pauseReason === null || agent.pauseReason === '' || !statusKeepsReason) {
          delete agent.pauseReason;
        }
        const statusKeepsPeer =
          agent.status === 'RINGING'
          || agent.status === 'IN_CALL'
          || agent.status === 'DIALING'
          || agent.status === 'CONSULT';
        if (agent.peerNumber === null || agent.peerNumber === '' || !statusKeepsPeer) {
          delete agent.peerNumber;
        }
        const statusKeepsDial =
          agent.status === 'DIALING'
          || agent.status === 'IN_CALL'
          || agent.status === 'CONSULT';
        if (agent.dialTarget === null || agent.dialTarget === '' || !statusKeepsDial) {
          delete agent.dialTarget;
        }
        state.agents.push(agent);
      }
    },

    // ─── Queue updates ────────────────────────────────────
    updateQueue(state, action: PayloadAction<IQueueStats>) {
      const data = action.payload;
      const idx = state.queues.findIndex(q => q.name === data.name);
      if (idx >= 0) {
        state.queues[idx] = { ...state.queues[idx], ...data };
      } else {
        state.queues.push(data);
      }
    },

    // ─── Call updates ─────────────────────────────────────
    addCall(state, action: PayloadAction<ICall>) {
      const idx = state.calls.findIndex(c => c.uniqueid === action.payload.uniqueid);
      if (idx < 0) {
        state.calls.push(action.payload);
      }
    },

    updateCall(state, action: PayloadAction<Partial<ICall> & { uniqueid: string }>) {
      const idx = state.calls.findIndex(c => c.uniqueid === action.payload.uniqueid);
      if (idx >= 0) {
        state.calls[idx] = { ...state.calls[idx], ...action.payload };
      } else if (action.payload.status) {
        // Upsert: callAnswer/callUpdate can arrive before callNew was applied
        state.calls.push(action.payload as ICall);
      }
    },

    removeCall(state, action: PayloadAction<string>) {
      state.calls = state.calls.filter(c => c.uniqueid !== action.payload);
    },

    chatMessageReceived(state, action: PayloadAction<IChatMessagePayload>) {
      const key = action.payload.channel_key;
      state.chatUnreadByChannel[key] = (state.chatUnreadByChannel[key] ?? 0) + 1;
    },

    markChannelRead(state, action: PayloadAction<string>) {
      delete state.chatUnreadByChannel[action.payload];
    },

    setChatOpen(state, action: PayloadAction<boolean>) {
      state.chatOpen = action.payload;
    },

    /** Queue a WebRTC outbound dial for SoftphoneWidget (click-to-call bridge). */
    requestOutboundDial(state, action: PayloadAction<string>) {
      const target = (action.payload || '').replace(/[^\d+*#]/g, '');
      state.pendingOutboundDial = target || null;
    },

    clearOutboundDial(state) {
      state.pendingOutboundDial = null;
    },
  },
});

export const {
  setSnapshot,
  setConnected,
  setMyAgentInterface,
  updateAgent,
  updateQueue,
  addCall,
  updateCall,
  removeCall,
  chatMessageReceived,
  markChannelRead,
  setChatOpen,
  requestOutboundDial,
  clearOutboundDial,
} = callCenterSlice.actions;

export default callCenterSlice.reducer;
