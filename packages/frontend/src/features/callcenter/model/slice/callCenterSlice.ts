import { createSlice, PayloadAction } from '@reduxjs/toolkit';
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
};

export const callCenterSlice = createSlice({
  name: 'callCenter',
  initialState,
  reducers: {
    // ─── Full snapshot (on SSE connect) ────────────────────
    setSnapshot(state, action: PayloadAction<ICcSnapshot>) {
      state.agents = action.payload.agents;
      state.queues = action.payload.queues;
      state.calls = action.payload.calls;
    },

    setConnected(state, action: PayloadAction<boolean>) {
      state.connected = action.payload;
    },

    setMyAgentInterface(state, action: PayloadAction<string | null>) {
      state.myAgentInterface = action.payload;
    },

    // ─── Agent updates ────────────────────────────────────
    updateAgent(state, action: PayloadAction<Partial<IAgent> & { interface: string; removed?: boolean }>) {
      const data = action.payload;
      if (data.removed) {
        state.agents = state.agents.filter(a => a.interface !== data.interface);
        return;
      }
      const idx = state.agents.findIndex(a => a.interface === data.interface);
      if (idx >= 0) {
        state.agents[idx] = { ...state.agents[idx], ...data };
      } else if (data.name && data.status) {
        // Only add as new agent if we have enough data
        state.agents.push(data as IAgent);
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
} = callCenterSlice.actions;

export default callCenterSlice.reducer;
