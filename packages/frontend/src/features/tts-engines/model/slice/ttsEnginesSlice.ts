import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { TtsEnginesSchema } from '../types/ttsEnginesSchema';
import type { ITtsEngine } from '@/entities/engines';

const initialState: TtsEnginesSchema = {
  isModalOpen: false,
  selectedEngine: null,
  modalMode: 'create',
};

export const ttsEnginesSlice = createSlice({
  name: 'ttsEngines',
  initialState,
  reducers: {
    openCreateModal: (state) => {
      state.isModalOpen = true;
      state.selectedEngine = null;
      state.modalMode = 'create';
    },
    openEditModal: (state, action: PayloadAction<ITtsEngine>) => {
      state.isModalOpen = true;
      state.selectedEngine = action.payload;
      state.modalMode = 'edit';
    },
    closeModal: (state) => {
      state.isModalOpen = false;
      state.selectedEngine = null;
    },
  },
});

export const { actions: ttsEnginesActions } = ttsEnginesSlice;
export const { reducer: ttsEnginesReducer } = ttsEnginesSlice;
