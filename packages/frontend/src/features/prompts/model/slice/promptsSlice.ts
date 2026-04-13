import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { PromptsSchema } from '../types/promptsSchema';
import type { IPrompt } from '@/entities/prompt';

const initialState: PromptsSchema = {
  isModalOpen: false,
  selectedPrompt: null,
  modalMode: 'upload',
};

export const promptsSlice = createSlice({
  name: 'prompts',
  initialState,
  reducers: {
    openUploadModal: (state) => {
      state.isModalOpen = true;
      state.selectedPrompt = null;
      state.modalMode = 'upload';
    },
    openRecordModal: (state) => {
      state.isModalOpen = true;
      state.selectedPrompt = null;
      state.modalMode = 'record';
    },
    closeModal: (state) => {
      state.isModalOpen = false;
      state.selectedPrompt = null;
    },
  },
});

export const { actions: promptsActions } = promptsSlice;
export const { reducer: promptsReducer } = promptsSlice;

