import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { IUser } from '@/entities/User';
import type { UsersPageSchema } from '../types/usersPageSchema';

const initialState: UsersPageSchema = {
  isModalOpen: false,
  selectedUser: null,
  modalMode: 'create',
};

export const usersPageSlice = createSlice({
  name: 'usersPage',
  initialState,
  reducers: {
    openCreateModal(state) {
      state.isModalOpen = true;
      state.selectedUser = null;
      state.modalMode = 'create';
    },
    openEditModal(state, action: PayloadAction<IUser>) {
      state.isModalOpen = true;
      state.selectedUser = action.payload;
      state.modalMode = 'edit';
    },
    closeModal(state) {
      state.isModalOpen = false;
      state.selectedUser = null;
    },
  },
});

export const { actions: usersPageActions } = usersPageSlice;
export const { reducer: usersPageReducer } = usersPageSlice;
