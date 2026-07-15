import { RootState } from '@/app/store/store';

export const selectNotificationsIsModalOpen = (state: RootState) =>
  state.notificationsPage.isModalOpen;

export const selectNotificationsModalMode = (state: RootState) =>
  state.notificationsPage.modalMode;

export const selectNotificationsSelectedUid = (state: RootState) =>
  state.notificationsPage.selectedIntegrationUid;
