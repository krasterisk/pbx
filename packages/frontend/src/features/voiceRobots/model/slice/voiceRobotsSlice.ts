import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { VoiceRobotsSchema } from '../types/voiceRobotsSchema';
import { IVoiceRobot } from '@/entities/voiceRobot';

const initialState: VoiceRobotsSchema = {
  isModalOpen: false,
  selectedRobot: null,
  isLogModalOpen: false,
  selectedRobotIdForLogs: null,
};

export const voiceRobotsSlice = createSlice({
  name: 'voiceRobots',
  initialState,
  reducers: {
    openModal: (state, action: PayloadAction<IVoiceRobot | null>) => {
      state.isModalOpen = true;
      state.selectedRobot = action.payload;
    },
    closeModal: (state) => {
      state.isModalOpen = false;
      state.selectedRobot = null;
    },
    openLogModal: (state, action: PayloadAction<number>) => {
      state.isLogModalOpen = true;
      state.selectedRobotIdForLogs = action.payload;
    },
    closeLogModal: (state) => {
      state.isLogModalOpen = false;
      state.selectedRobotIdForLogs = null;
    },
  },
});

export const { actions: voiceRobotsActions } = voiceRobotsSlice;
export const { reducer: voiceRobotsReducer } = voiceRobotsSlice;
