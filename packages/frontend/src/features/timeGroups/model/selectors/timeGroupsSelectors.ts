import type { RootState } from '@/app/store/store';

export const getTimeGroupsModalOpen = (state: RootState) => state.timeGroups.modalOpen;
export const getTimeGroupsModalMode = (state: RootState) => state.timeGroups.modalMode;
export const getTimeGroupsEditingItem = (state: RootState) => state.timeGroups.editingItem;
export const getTimeGroupsSelectedIds = (state: RootState) => state.timeGroups.selectedIds;
