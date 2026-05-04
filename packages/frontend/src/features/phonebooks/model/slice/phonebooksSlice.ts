import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { IRoutePhonebook } from '@krasterisk/shared';

export interface PhonebooksState {
  modalOpen: boolean;
  modalMode: 'create' | 'edit' | 'copy';
  editingItem: IRoutePhonebook | null;
  selectedIds: number[];
}

const initialState: PhonebooksState = {
  modalOpen: false,
  modalMode: 'create',
  editingItem: null,
  selectedIds: [],
};

const phonebooksSlice = createSlice({
  name: 'phonebooks',
  initialState,
  reducers: {
    openCreateModal(state) {
      state.modalOpen = true;
      state.modalMode = 'create';
      state.editingItem = null;
    },
    openEditModal(state, action: PayloadAction<IRoutePhonebook>) {
      state.modalOpen = true;
      state.modalMode = 'edit';
      state.editingItem = action.payload;
    },
    openCopyModal(state, action: PayloadAction<IRoutePhonebook>) {
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

export const { actions: phonebooksActions, reducer: phonebooksReducer } = phonebooksSlice;
