import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { IvrsSchema } from '../types/ivrsSchema';
import type { IIvr } from '@/entities/ivr';

const initialState: IvrsSchema = {
  isModalOpen: false,
  selectedIvr: null,
  modalMode: 'create',
};

export const ivrsSlice = createSlice({
  name: 'ivrs',
  initialState,
  reducers: {
    openCreateModal: (state) => {
      state.isModalOpen = true;
      state.selectedIvr = null;
      state.modalMode = 'create';
    },
    openEditModal: (state, action: PayloadAction<IIvr>) => {
      state.isModalOpen = true;
      state.selectedIvr = action.payload;
      state.modalMode = 'edit';
    },
    closeModal: (state) => {
      state.isModalOpen = false;
      state.selectedIvr = null;
    },
  },
});

export const { actions: ivrsActions } = ivrsSlice;
export const { reducer: ivrsReducer } = ivrsSlice;
