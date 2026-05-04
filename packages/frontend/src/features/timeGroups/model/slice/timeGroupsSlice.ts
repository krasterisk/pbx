import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { ITimeGroup } from '@krasterisk/shared';

export interface TimeGroupsState {
  modalOpen: boolean;
  modalMode: 'create' | 'edit' | 'copy';
  editingItem: ITimeGroup | null;
  selectedIds: number[];
}

const initialState: TimeGroupsState = {
  modalOpen: false,
  modalMode: 'create',
  editingItem: null,
  selectedIds: [],
};

const timeGroupsSlice = createSlice({
  name: 'timeGroups',
  initialState,
  reducers: {
    openCreateModal(state) {
      state.modalOpen = true;
      state.modalMode = 'create';
      state.editingItem = null;
    },
    openEditModal(state, action: PayloadAction<ITimeGroup>) {
      state.modalOpen = true;
      state.modalMode = 'edit';
      state.editingItem = action.payload;
    },
    openCopyModal(state, action: PayloadAction<ITimeGroup>) {
      state.modalOpen = true;
      state.modalMode = 'copy';
      state.editingItem = action.payload;
    },
    closeModal(state) {
      state.modalOpen = false;
      state.editingItem = null;
    },
    setSelectedIds(state, action: PayloadAction<number[]>) {
      state.selectedIds = action.payload;
    },
    clearSelection(state) {
      state.selectedIds = [];
    },
  },
});

export const { actions: timeGroupsActions, reducer: timeGroupsReducer } = timeGroupsSlice;
