import { describe, it, expect } from 'vitest';
import type { RootState } from '@/app/store/store';
import { selectIsModalOpen, selectSelectedUser, selectModalMode } from './usersPageSelectors';
import { UserLevel } from '@krasterisk/shared';
import type { IUser } from '@/entities/User';

const mockUser: IUser = {
  uniqueid: 1,
  login: 'testuser',
  name: 'Test',
  email: '',
  exten: '101',
  level: UserLevel.OPERATOR,
  role: 0,
  numbers_id: 0,
  permit_extens: '',
  listbook_edit: 0,
  oper_chanspy: 0,
  outbound_posttime: 0,
  suspension_time: 0,
  inactive_time: 0,
  user_uid: 0,
};

describe('usersPageSelectors', () => {
  const state = {
    usersPage: {
      isModalOpen: true,
      selectedUser: mockUser,
      modalMode: 'edit' as const,
    },
  } as RootState;

  it('selectIsModalOpen returns isModalOpen', () => {
    expect(selectIsModalOpen(state)).toBe(true);
  });

  it('selectSelectedUser returns the selected user', () => {
    expect(selectSelectedUser(state)).toEqual(mockUser);
    expect(selectSelectedUser(state)?.login).toBe('testuser');
  });

  it('selectModalMode returns the mode', () => {
    expect(selectModalMode(state)).toBe('edit');
  });

  it('returns false/null for closed modal', () => {
    const closedState = {
      usersPage: {
        isModalOpen: false,
        selectedUser: null,
        modalMode: 'create' as const,
      },
    } as RootState;
    expect(selectIsModalOpen(closedState)).toBe(false);
    expect(selectSelectedUser(closedState)).toBeNull();
  });
});
