import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { IDirectory } from '@krasterisk/shared';

export interface DirectoriesState {
  modalOpen: boolean;
  modalMode: 'create' | 'edit' | 'copy';
  editingItem: IDirectory | null;
  selectedIds: number[];
}

const initialState: DirectoriesState = {
  modalOpen: false,
  modalMode: 'create',
  editingItem: null,
  selectedIds: [],
};

const directoriesSlice = createSlice({
  name: 'directories',
  initialState,
  reducers: {
    openCreateModal(state) {
      state.modalOpen = true;
      state.modalMode = 'create';
      state.editingItem = null;
    },
    openEditModal(state, action: PayloadAction<IDirectory>) {
      state.modalOpen = true;
      state.modalMode = 'edit';
      state.editingItem = action.payload;
    },
    openCopyModal(state, action: PayloadAction<IDirectory>) {
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

export const { actions: directoriesActions, reducer: directoriesReducer } = directoriesSlice;
