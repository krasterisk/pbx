import { describe, it, expect } from 'vitest';
import { rolesPageReducer, rolesPageActions } from './rolesPageSlice';
import type { RolesPageSchema } from '../types/rolesPageSchema';
import type { IRole } from '@/shared/api/api';

const mockRole: IRole = {
  id: 1,
  name: 'Admin',
  comment: 'Admin role',
};

describe('rolesPageSlice', () => {
  const initialState: RolesPageSchema = {
    isModalOpen: false,
    selectedRole: null,
    modalMode: 'create',
  };

  it('should return initial state', () => {
    expect(rolesPageReducer(undefined, { type: 'unknown' })).toEqual(initialState);
  });

  it('should handle openCreateModal', () => {
    const state = rolesPageReducer(initialState, rolesPageActions.openCreateModal());
    expect(state.isModalOpen).toBe(true);
    expect(state.selectedRole).toBeNull();
    expect(state.modalMode).toBe('create');
  });

  it('should handle openEditModal', () => {
    const state = rolesPageReducer(initialState, rolesPageActions.openEditModal(mockRole));
    expect(state.isModalOpen).toBe(true);
    expect(state.selectedRole).toEqual(mockRole);
    expect(state.modalMode).toBe('edit');
  });

  it('should handle closeModal', () => {
    const openState: RolesPageSchema = {
      isModalOpen: true,
      selectedRole: mockRole,
      modalMode: 'edit',
    };
    const state = rolesPageReducer(openState, rolesPageActions.closeModal());
    expect(state.isModalOpen).toBe(false);
    expect(state.selectedRole).toBeNull();
  });
});
