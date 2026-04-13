import type { RootState as StateSchema } from '@/app/store/store';

export const getRolesPageIsModalOpen = (state: StateSchema) => state.rolesPage?.isModalOpen || false;
export const getRolesPageSelectedRole = (state: StateSchema) => state.rolesPage?.selectedRole || null;
export const getRolesPageModalMode = (state: StateSchema) => state.rolesPage?.modalMode || 'create';
