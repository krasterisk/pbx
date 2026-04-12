import type { RootState } from '@/app/store/store';

export const selectTrunkIsModalOpen = (state: RootState) => state.trunksPage.isModalOpen;
export const selectSelectedTrunk = (state: RootState) => state.trunksPage.selectedTrunk;
export const selectTrunkModalMode = (state: RootState) => state.trunksPage.modalMode;
