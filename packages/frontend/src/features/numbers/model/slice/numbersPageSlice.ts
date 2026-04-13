import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { NumbersPageSchema } from '../types/numbersPageSchema';
import type { INumberList } from '@/shared/api/api';

const initialState: NumbersPageSchema = {
  isModalOpen: false,
  selectedNumber: null,
  modalMode: 'create',
};

export const numbersPageSlice = createSlice({
  name: 'numbersPage',
  initialState,
  reducers: {
    openCreateModal: (state) => {
      state.isModalOpen = true;
      state.selectedNumber = null;
      state.modalMode = 'create';
    },
    openEditModal: (state, action: PayloadAction<INumberList>) => {
      state.isModalOpen = true;
      state.selectedNumber = action.payload;
      state.modalMode = 'edit';
    },
    closeModal: (state) => {
      state.isModalOpen = false;
      state.selectedNumber = null;
    },
  },
});

export const { actions: numbersPageActions } = numbersPageSlice;
export const { reducer: numbersPageReducer } = numbersPageSlice;
