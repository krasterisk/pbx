import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { ITenant } from '@/entities/tenant';
import type { TenantsPageSchema } from '../types/tenantsPageSchema';

const initialState: TenantsPageSchema = {
  isModalOpen: false,
  modalMode: 'create',
  selectedTenant: null,
  searchQuery: '',
  statusFilter: '',
};

export const tenantsPageSlice = createSlice({
  name: 'tenantsPage',
  initialState,
  reducers: {
    openCreateModal(state) {
      state.isModalOpen = true;
      state.modalMode = 'create';
      state.selectedTenant = null;
    },
    openEditModal(state, action: PayloadAction<ITenant>) {
      state.isModalOpen = true;
      state.modalMode = 'edit';
      state.selectedTenant = action.payload;
    },
    openTenantDrawer(state, action: PayloadAction<ITenant>) {
      state.isModalOpen = false;
      state.selectedTenant = action.payload;
    },
    closeModal(state) {
      state.isModalOpen = false;
      state.selectedTenant = null;
    },
    setSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload;
    },
    setStatusFilter(state, action: PayloadAction<string>) {
      state.statusFilter = action.payload;
    },
  },
});

export const { actions: tenantsPageActions } = tenantsPageSlice;
export const { reducer: tenantsPageReducer } = tenantsPageSlice;
