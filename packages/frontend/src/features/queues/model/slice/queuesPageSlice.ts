import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { QueuesPageSchema } from '../types/queuesSchema';

const initialState: QueuesPageSchema = {
  isModalOpen: false,
  modalMode: 'create',
  selectedQueueName: null,
};

export const queuesPageSlice = createSlice({
  name: 'queuesPage',
  initialState,
  reducers: {
    openCreateModal(state) {
      state.isModalOpen = true;
      state.modalMode = 'create';
      state.selectedQueueName = null;
    },
    openEditModal(state, action: PayloadAction<string>) {
      state.isModalOpen = true;
      state.modalMode = 'edit';
      state.selectedQueueName = action.payload;
    },
    openCopyModal(state, action: PayloadAction<string>) {
      state.isModalOpen = true;
      state.modalMode = 'copy';
      state.selectedQueueName = action.payload;
    },
    closeModal(state) {
      state.isModalOpen = false;
      state.selectedQueueName = null;
    },
  },
});

export const { actions: queuesPageActions, reducer: queuesPageReducer } = queuesPageSlice;
