import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RoutesSchema } from '../types/routesSchema';
import { IRoute } from '@/shared/api/api';

const initialState: RoutesSchema = {
  isModalOpen: false,
  selectedRoute: null,
  selectedContextUid: null,
  editorMode: 'table',
};

export const routesSlice = createSlice({
  name: 'routes',
  initialState,
  reducers: {
    selectContext: (state, action: PayloadAction<number>) => {
      state.selectedContextUid = action.payload;
    },
    openCreateModal: (state) => {
      state.selectedRoute = null;
      state.isModalOpen = true;
    },
    openEditModal: (state, action: PayloadAction<IRoute>) => {
      state.selectedRoute = action.payload;
      state.isModalOpen = true;
    },
    closeModal: (state) => {
      state.isModalOpen = false;
      state.selectedRoute = null;
    },
    setEditorMode: (state, action: PayloadAction<'table' | 'raw'>) => {
      state.editorMode = action.payload;
    },
  },
});

export const { actions: routesActions } = routesSlice;
export const { reducer: routesReducer } = routesSlice;
