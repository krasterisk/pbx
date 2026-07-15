import { RootState } from '@/app/store/store';

export const selectCallGroupsIsModalOpen = (state: RootState) => state.callGroupsPage.isModalOpen;
export const selectCallGroupsModalMode = (state: RootState) => state.callGroupsPage.modalMode;
export const selectCallGroupsSelectedUid = (state: RootState) => state.callGroupsPage.selectedCallGroupUid;
