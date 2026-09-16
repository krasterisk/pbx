import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { ConferenceRole } from '@/shared/api/endpoints/conferenceRoomApi';

export interface ConferenceSessionState {
  roomUid: number | null;
  number: string | null;
  name: string | null;
  role: ConferenceRole | null;
  startedAt: string | null;
  sipId: string | null;
}

export interface EnterConferenceSessionPayload {
  roomUid: number;
  number: string;
  name?: string;
  role: ConferenceRole;
  sipId?: string | null;
  startedAt?: string;
}

const initialState: ConferenceSessionState = {
  roomUid: null,
  number: null,
  name: null,
  role: null,
  startedAt: null,
  sipId: null,
};

const conferenceSessionSlice = createSlice({
  name: 'conferenceSession',
  initialState,
  reducers: {
    enterSession(state, action: PayloadAction<EnterConferenceSessionPayload>) {
      state.roomUid = action.payload.roomUid;
      state.number = action.payload.number;
      state.name = action.payload.name ?? null;
      state.role = action.payload.role;
      state.sipId = action.payload.sipId ?? null;
      state.startedAt = action.payload.startedAt ?? new Date().toISOString();
    },
    leaveSession() {
      return initialState;
    },
    patchMeta(
      state,
      action: PayloadAction<
        Partial<Pick<ConferenceSessionState, 'name' | 'number' | 'role' | 'sipId'>>
      >,
    ) {
      if (action.payload.name !== undefined) state.name = action.payload.name;
      if (action.payload.number !== undefined) state.number = action.payload.number;
      if (action.payload.role !== undefined) state.role = action.payload.role;
      if (action.payload.sipId !== undefined) state.sipId = action.payload.sipId;
    },
  },
});

export const { enterSession, leaveSession, patchMeta } = conferenceSessionSlice.actions;

export function selectConferenceSession(state: {
  conferenceSession?: ConferenceSessionState;
}): ConferenceSessionState | null {
  const session = state.conferenceSession;
  if (!session || session.roomUid == null) return null;
  return session;
}

export default conferenceSessionSlice.reducer;
