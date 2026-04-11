import type { IUser } from '@/entities/User';

export interface UsersPageSchema {
  /** Is the create/edit modal open */
  isModalOpen: boolean;
  /** Currently selected user for editing, null = create mode */
  selectedUser: IUser | null;
  /** Modal mode */
  modalMode: 'create' | 'edit';
}
