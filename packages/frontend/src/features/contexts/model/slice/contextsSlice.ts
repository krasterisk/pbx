import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ContextsSchema } from '../types/contextsSchema';
import { IContext } from '@/shared/api/api';

const initialState: ContextsSchema = {
  isModalOpen: false,
  selectedContext: null,
};

export const contextsSlice = createSlice({
  name: 'contexts',
  initialState,
  reducers: {
    openCreateModal: (state) => {
      state.selectedContext = null;
      state.isModalOpen = true;
    },
    openEditModal: (state, action: PayloadAction<IContext>) => {
      state.selectedContext = action.payload;
      state.isModalOpen = true;
    },
    closeModal: (state) => {
      state.isModalOpen = false;
      state.selectedContext = null;
    },
  },
});

export const { actions: contextsActions } = contextsSlice;
export const { reducer: contextsReducer } = contextsSlice;
