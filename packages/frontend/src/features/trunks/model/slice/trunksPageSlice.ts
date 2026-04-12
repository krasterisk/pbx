import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { ITrunkListItem } from '@/shared/api/endpoints/trunkApi';

export interface TrunksPageSchema {
  isModalOpen: boolean;
  selectedTrunk: ITrunkListItem | null;
  modalMode: 'create' | 'edit' | 'copy';
}

const initialState: TrunksPageSchema = {
  isModalOpen: false,
  selectedTrunk: null,
  modalMode: 'create',
};

export const trunksPageSlice = createSlice({
  name: 'trunksPage',
  initialState,
  reducers: {
    openCreateModal(state) {
      state.isModalOpen = true;
      state.selectedTrunk = null;
      state.modalMode = 'create';
    },
    openEditModal(state, action: PayloadAction<ITrunkListItem>) {
      state.isModalOpen = true;
      state.selectedTrunk = action.payload;
      state.modalMode = 'edit';
    },
    openCopyModal(state, action: PayloadAction<ITrunkListItem>) {
      state.isModalOpen = true;
      state.selectedTrunk = action.payload;
      state.modalMode = 'copy';
    },
    closeModal(state) {
      state.isModalOpen = false;
      state.selectedTrunk = null;
    },
  },
});

export const { actions: trunksPageActions } = trunksPageSlice;
export const { reducer: trunksPageReducer } = trunksPageSlice;
