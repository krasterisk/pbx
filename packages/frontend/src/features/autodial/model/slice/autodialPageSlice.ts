import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type AutodialModalMode = 'create' | 'edit' | 'copy';

export interface AutodialPageSchema {
  isCampaignModalOpen: boolean;
  campaignModalMode: AutodialModalMode;
  selectedCampaignUid: number | null;
  isBaseModalOpen: boolean;
  baseModalMode: AutodialModalMode;
  /** Base whose schema/contacts are shown on /autodial/bases. */
  activeBaseUid: number | null;
  isImportOpen: boolean;
  isContactModalOpen: boolean;
  selectedContactUid: number | null;
}

const initialState: AutodialPageSchema = {
  isCampaignModalOpen: false,
  campaignModalMode: 'create',
  selectedCampaignUid: null,
  isBaseModalOpen: false,
  baseModalMode: 'create',
  activeBaseUid: null,
  isImportOpen: false,
  isContactModalOpen: false,
  selectedContactUid: null,
};

export const autodialPageSlice = createSlice({
  name: 'autodialPage',
  initialState,
  reducers: {
    openCreateCampaign(state) {
      state.isCampaignModalOpen = true;
      state.campaignModalMode = 'create';
      state.selectedCampaignUid = null;
    },
    openEditCampaign(state, action: PayloadAction<number>) {
      state.isCampaignModalOpen = true;
      state.campaignModalMode = 'edit';
      state.selectedCampaignUid = action.payload;
    },
    openCopyCampaign(state, action: PayloadAction<number>) {
      state.isCampaignModalOpen = true;
      state.campaignModalMode = 'copy';
      state.selectedCampaignUid = action.payload;
    },
    closeCampaignModal(state) {
      state.isCampaignModalOpen = false;
      state.selectedCampaignUid = null;
    },

    openCreateBase(state) {
      state.isBaseModalOpen = true;
      state.baseModalMode = 'create';
    },
    openEditBase(state, action: PayloadAction<number>) {
      state.isBaseModalOpen = true;
      state.baseModalMode = 'edit';
      state.activeBaseUid = action.payload;
    },
    closeBaseModal(state) {
      state.isBaseModalOpen = false;
    },

    selectBase(state, action: PayloadAction<number | null>) {
      state.activeBaseUid = action.payload;
      state.isContactModalOpen = false;
      state.selectedContactUid = null;
    },

    openImport(state) {
      state.isImportOpen = true;
    },
    closeImport(state) {
      state.isImportOpen = false;
    },

    openCreateContact(state) {
      state.isContactModalOpen = true;
      state.selectedContactUid = null;
    },
    openEditContact(state, action: PayloadAction<number>) {
      state.isContactModalOpen = true;
      state.selectedContactUid = action.payload;
    },
    closeContactModal(state) {
      state.isContactModalOpen = false;
      state.selectedContactUid = null;
    },
  },
});

export const { actions: autodialPageActions, reducer: autodialPageReducer } = autodialPageSlice;

type WithAutodial = { autodialPage: AutodialPageSchema };

export const selectAutodialCampaignModalOpen = (s: WithAutodial) =>
  s.autodialPage.isCampaignModalOpen;
export const selectAutodialCampaignModalMode = (s: WithAutodial) =>
  s.autodialPage.campaignModalMode;
export const selectAutodialSelectedCampaignUid = (s: WithAutodial) =>
  s.autodialPage.selectedCampaignUid;
export const selectAutodialBaseModalOpen = (s: WithAutodial) => s.autodialPage.isBaseModalOpen;
export const selectAutodialBaseModalMode = (s: WithAutodial) => s.autodialPage.baseModalMode;
export const selectAutodialActiveBaseUid = (s: WithAutodial) => s.autodialPage.activeBaseUid;
export const selectAutodialImportOpen = (s: WithAutodial) => s.autodialPage.isImportOpen;
export const selectAutodialContactModalOpen = (s: WithAutodial) =>
  s.autodialPage.isContactModalOpen;
export const selectAutodialSelectedContactUid = (s: WithAutodial) =>
  s.autodialPage.selectedContactUid;
