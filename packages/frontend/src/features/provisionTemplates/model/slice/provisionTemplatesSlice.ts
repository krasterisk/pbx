import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ProvisionTemplatesSchema } from '../types/provisionTemplatesSchema';
import { IProvisionTemplate } from '@/shared/api/api';

const initialState: ProvisionTemplatesSchema = {
  isModalOpen: false,
  selectedTemplate: null,
};

export const provisionTemplatesSlice = createSlice({
  name: 'provisionTemplates',
  initialState,
  reducers: {
    openCreateModal: (state) => {
      state.selectedTemplate = null;
      state.isModalOpen = true;
    },
    openEditModal: (state, action: PayloadAction<IProvisionTemplate>) => {
      state.selectedTemplate = action.payload;
      state.isModalOpen = true;
    },
    closeModal: (state) => {
      state.isModalOpen = false;
      state.selectedTemplate = null;
    },
  },
});

export const { actions: provisionTemplatesActions } = provisionTemplatesSlice;
export const { reducer: provisionTemplatesReducer } = provisionTemplatesSlice;
