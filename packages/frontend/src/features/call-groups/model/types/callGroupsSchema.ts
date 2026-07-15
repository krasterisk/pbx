export type CallGroupsModalMode = 'create' | 'edit' | 'copy';

export interface CallGroupsPageSchema {
  isModalOpen: boolean;
  modalMode: CallGroupsModalMode;
  selectedCallGroupUid: number | null;
}
