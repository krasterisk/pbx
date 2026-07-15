import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CallGroupsPageSchema } from '../types/callGroupsSchema';

const initialState: CallGroupsPageSchema = {
  isModalOpen: false,
  modalMode: 'create',
  selectedCallGroupUid: null,
};

export const callGroupsPageSlice = createSlice({
  name: 'callGroupsPage',
  initialState,
  reducers: {
    openCreateModal(state) {
      state.isModalOpen = true;
      state.modalMode = 'create';
      state.selectedCallGroupUid = null;
    },
    openEditModal(state, action: PayloadAction<number>) {
      state.isModalOpen = true;
      state.modalMode = 'edit';
      state.selectedCallGroupUid = action.payload;
    },
    openCopyModal(state, action: PayloadAction<number>) {
      state.isModalOpen = true;
      state.modalMode = 'copy';
      state.selectedCallGroupUid = action.payload;
    },
    closeModal(state) {
      state.isModalOpen = false;
      state.selectedCallGroupUid = null;
    },
  },
});

export const { actions: callGroupsPageActions, reducer: callGroupsPageReducer } = callGroupsPageSlice;
