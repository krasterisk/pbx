export interface RolesPageSchema {
  isModalOpen: boolean;
  selectedRole: any | null; // will be IRole when imported
  modalMode: 'create' | 'edit';
}
