import type { RootState } from '@/app/store/store';

export const getPhonebooksModalOpen = (state: RootState) => state.phonebooks.modalOpen;
export const getPhonebooksModalMode = (state: RootState) => state.phonebooks.modalMode;
export const getPhonebooksEditingItem = (state: RootState) => state.phonebooks.editingItem;
export const getPhonebooksSelectedIds = (state: RootState) => state.phonebooks.selectedIds;
