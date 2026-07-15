import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { NotificationsPageSchema } from '../types/notificationsSchema';

const initialState: NotificationsPageSchema = {
  isModalOpen: false,
  modalMode: 'create',
  selectedIntegrationUid: null,
};

export const notificationsPageSlice = createSlice({
  name: 'notificationsPage',
  initialState,
  reducers: {
    openCreateModal(state) {
      state.isModalOpen = true;
      state.modalMode = 'create';
      state.selectedIntegrationUid = null;
    },
    openEditModal(state, action: PayloadAction<number>) {
      state.isModalOpen = true;
      state.modalMode = 'edit';
      state.selectedIntegrationUid = action.payload;
    },
    openCopyModal(state, action: PayloadAction<number>) {
      state.isModalOpen = true;
      state.modalMode = 'copy';
      state.selectedIntegrationUid = action.payload;
    },
    closeModal(state) {
      state.isModalOpen = false;
      state.selectedIntegrationUid = null;
    },
  },
});

export const { actions: notificationsPageActions, reducer: notificationsPageReducer } =
  notificationsPageSlice;
