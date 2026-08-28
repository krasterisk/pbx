import type { RootState } from '@/app/store/store';

export const getDirectoriesModalOpen = (state: RootState) => state.directories.modalOpen;
export const getDirectoriesModalMode = (state: RootState) => state.directories.modalMode;
export const getDirectoriesEditingItem = (state: RootState) => state.directories.editingItem;
export const getDirectoriesSelectedIds = (state: RootState) => state.directories.selectedIds;
