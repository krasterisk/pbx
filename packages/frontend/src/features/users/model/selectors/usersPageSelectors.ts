import type { RootState } from '@/app/store/store';

export const selectIsModalOpen = (state: RootState) => state.usersPage.isModalOpen;
export const selectSelectedUser = (state: RootState) => state.usersPage.selectedUser;
export const selectModalMode = (state: RootState) => state.usersPage.modalMode;
