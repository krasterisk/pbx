import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type ConferencesModalMode = 'create' | 'edit' | 'copy';

export interface ConferencesPageSchema {
  isModalOpen: boolean;
  modalMode: ConferencesModalMode;
  selectedConferenceUid: number | null;
}

const initialState: ConferencesPageSchema = {
  isModalOpen: false,
  modalMode: 'create',
  selectedConferenceUid: null,
};

export const conferencesPageSlice = createSlice({
  name: 'conferencesPage',
  initialState,
  reducers: {
    openCreateModal(state) {
      state.isModalOpen = true;
      state.modalMode = 'create';
      state.selectedConferenceUid = null;
    },
    openEditModal(state, action: PayloadAction<number>) {
      state.isModalOpen = true;
      state.modalMode = 'edit';
      state.selectedConferenceUid = action.payload;
    },
    openCopyModal(state, action: PayloadAction<number>) {
      state.isModalOpen = true;
      state.modalMode = 'copy';
      state.selectedConferenceUid = action.payload;
    },
    closeModal(state) {
      state.isModalOpen = false;
      state.selectedConferenceUid = null;
    },
  },
});

export const { actions: conferencesPageActions, reducer: conferencesPageReducer } = conferencesPageSlice;

export const selectConferencesIsModalOpen = (state: { conferencesPage: ConferencesPageSchema }) =>
  state.conferencesPage.isModalOpen;
export const selectConferencesModalMode = (state: { conferencesPage: ConferencesPageSchema }) =>
  state.conferencesPage.modalMode;
export const selectConferencesSelectedUid = (state: { conferencesPage: ConferencesPageSchema }) =>
  state.conferencesPage.selectedConferenceUid;
