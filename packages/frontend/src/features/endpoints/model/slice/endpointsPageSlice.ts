import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { IEndpointListItem } from '@/shared/api/endpoints/endpointApi';

export interface EndpointsPageSchema {
  isModalOpen: boolean;
  isBulkModalOpen: boolean;
  selectedEndpoint: IEndpointListItem | null;
  modalMode: 'create' | 'edit';
  credentialsSipId: string | null;
}

const initialState: EndpointsPageSchema = {
  isModalOpen: false,
  isBulkModalOpen: false,
  selectedEndpoint: null,
  modalMode: 'create',
  credentialsSipId: null,
};

export const endpointsPageSlice = createSlice({
  name: 'endpointsPage',
  initialState,
  reducers: {
    openCreateModal(state) {
      state.isModalOpen = true;
      state.selectedEndpoint = null;
      state.modalMode = 'create';
    },
    openEditModal(state, action: PayloadAction<IEndpointListItem>) {
      state.isModalOpen = true;
      state.selectedEndpoint = action.payload;
      state.modalMode = 'edit';
    },
    closeModal(state) {
      state.isModalOpen = false;
      state.selectedEndpoint = null;
    },
    openBulkModal(state) {
      state.isBulkModalOpen = true;
    },
    closeBulkModal(state) {
      state.isBulkModalOpen = false;
    },
    openCredentialsModal(state, action: PayloadAction<string>) {
      state.credentialsSipId = action.payload;
    },
    closeCredentialsModal(state) {
      state.credentialsSipId = null;
    },
  },
});

export const { actions: endpointsPageActions } = endpointsPageSlice;
export const { reducer: endpointsPageReducer } = endpointsPageSlice;
