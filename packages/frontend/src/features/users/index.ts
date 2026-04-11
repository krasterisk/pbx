/**
 * Feature: Users Management — Public API
 */

// Slice
export { usersPageReducer, usersPageActions } from './model/slice/usersPageSlice';
export type { UsersPageSchema } from './model/types/usersPageSchema';

// Selectors
export {
  selectIsModalOpen,
  selectSelectedUser,
  selectModalMode,
} from './model/selectors/usersPageSelectors';

// UI Components
export { UsersTable } from './ui/UsersTable/UsersTable';
export { UserFormModal } from './ui/UserFormModal/UserFormModal';
