import { describe, it, expect } from 'vitest';
import { usersPageReducer, usersPageActions } from './usersPageSlice';
import type { UsersPageSchema } from '../types/usersPageSchema';
import type { IUser } from '@/entities/User';
import { UserLevel } from '@krasterisk/shared';

const mockUser: IUser = {
  uniqueid: 1,
  login: 'admin',
  name: 'Admin User',
  email: 'admin@test.com',
  exten: '100',
  level: UserLevel.ADMIN,
  role: 1,
  numbers_id: 0,
  permit_extens: '',
  listbook_edit: 0,
  oper_chanspy: 0,
  outbound_posttime: 0,
  suspension_time: 0,
  inactive_time: 0,
  user_uid: 0,
};

describe('usersPageSlice', () => {
  const initialState: UsersPageSchema = {
    isModalOpen: false,
    selectedUser: null,
    modalMode: 'create',
  };

  it('should return initial state', () => {
    expect(usersPageReducer(undefined, { type: 'unknown' })).toEqual(initialState);
  });

  it('should handle openCreateModal', () => {
    const state = usersPageReducer(initialState, usersPageActions.openCreateModal());
    expect(state.isModalOpen).toBe(true);
    expect(state.selectedUser).toBeNull();
    expect(state.modalMode).toBe('create');
  });

  it('should handle openEditModal', () => {
    const state = usersPageReducer(initialState, usersPageActions.openEditModal(mockUser));
    expect(state.isModalOpen).toBe(true);
    expect(state.selectedUser).toEqual(mockUser);
    expect(state.modalMode).toBe('edit');
  });

  it('should handle closeModal', () => {
    const openState: UsersPageSchema = {
      isModalOpen: true,
      selectedUser: mockUser,
      modalMode: 'edit',
    };
    const state = usersPageReducer(openState, usersPageActions.closeModal());
    expect(state.isModalOpen).toBe(false);
    expect(state.selectedUser).toBeNull();
  });

  it('should handle openEditModal after openCreateModal', () => {
    let state = usersPageReducer(initialState, usersPageActions.openCreateModal());
    state = usersPageReducer(state, usersPageActions.closeModal());
    state = usersPageReducer(state, usersPageActions.openEditModal(mockUser));
    expect(state.modalMode).toBe('edit');
    expect(state.selectedUser?.login).toBe('admin');
  });
});
