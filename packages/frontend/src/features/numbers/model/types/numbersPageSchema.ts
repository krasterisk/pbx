export interface NumbersPageSchema {
  isModalOpen: boolean;
  selectedNumber: any | null; // will be INumberList when imported
  modalMode: 'create' | 'edit';
}
