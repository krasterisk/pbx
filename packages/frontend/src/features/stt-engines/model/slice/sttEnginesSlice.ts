import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { SttEnginesSchema } from '../types/sttEnginesSchema';
import type { ISttEngine } from '@/entities/engines';

const initialState: SttEnginesSchema = {
  isModalOpen: false,
  selectedEngine: null,
  modalMode: 'create',
};

export const sttEnginesSlice = createSlice({
  name: 'sttEngines',
  initialState,
  reducers: {
    openCreateModal: (state) => {
      state.isModalOpen = true;
      state.selectedEngine = null;
      state.modalMode = 'create';
    },
    openEditModal: (state, action: PayloadAction<ISttEngine>) => {
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

export const { actions: sttEnginesActions } = sttEnginesSlice;
export const { reducer: sttEnginesReducer } = sttEnginesSlice;
