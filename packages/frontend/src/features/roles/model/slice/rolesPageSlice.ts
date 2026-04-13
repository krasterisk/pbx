import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RolesPageSchema } from '../types/rolesPageSchema';
import type { IRole } from '@/shared/api/api';

const initialState: RolesPageSchema = {
  isModalOpen: false,
  selectedRole: null,
  modalMode: 'create',
};

export const rolesPageSlice = createSlice({
  name: 'rolesPage',
  initialState,
  reducers: {
    openCreateModal: (state) => {
      state.isModalOpen = true;
      state.selectedRole = null;
      state.modalMode = 'create';
    },
    openEditModal: (state, action: PayloadAction<IRole>) => {
      state.isModalOpen = true;
      state.selectedRole = action.payload;
      state.modalMode = 'edit';
    },
    closeModal: (state) => {
      state.isModalOpen = false;
      state.selectedRole = null;
    },
  },
});

export const { actions: rolesPageActions } = rolesPageSlice;
export const { reducer: rolesPageReducer } = rolesPageSlice;
