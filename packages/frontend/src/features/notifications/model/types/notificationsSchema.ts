export interface NotificationsPageSchema {
  isModalOpen: boolean;
  modalMode: 'create' | 'edit' | 'copy';
  selectedIntegrationUid: number | null;
}
