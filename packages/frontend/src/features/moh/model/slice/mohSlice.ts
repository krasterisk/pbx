import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { MohSchema } from '../types/mohSchema';
import type { IMohClass } from '@/entities/moh';

const initialState: MohSchema = {
  isModalOpen: false,
  selectedMoh: null,
  modalMode: 'create',
};

export const mohSlice = createSlice({
  name: 'moh',
  initialState,
  reducers: {
    openCreateModal: (state) => {
      state.isModalOpen = true;
      state.selectedMoh = null;
      state.modalMode = 'create';
    },
    openEditModal: (state, action: PayloadAction<IMohClass>) => {
      state.isModalOpen = true;
      state.selectedMoh = action.payload;
      state.modalMode = 'edit';
    },
    closeModal: (state) => {
      state.isModalOpen = false;
      state.selectedMoh = null;
    },
  },
});

export const { actions: mohActions } = mohSlice;
export const { reducer: mohReducer } = mohSlice;
