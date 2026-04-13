import { describe, it, expect } from 'vitest';
import { ivrsReducer, ivrsActions } from './ivrsSlice';
import type { IvrsSchema } from '../types/ivrsSchema';
import type { IIvr } from '@/entities/ivr';

const mockIvr = {
  uid: 1,
  name: 'Main Menu',
  exten: '100',
  timeout: 10,
  max_count: 3,
  description: 'Main auto attendant',
} as IIvr;

describe('ivrsSlice', () => {
  const initialState: IvrsSchema = {
    isModalOpen: false,
    selectedIvr: null,
    modalMode: 'create',
  };

  it('should return initial state', () => {
    expect(ivrsReducer(undefined, { type: 'unknown' })).toEqual(initialState);
  });

  it('should handle openCreateModal', () => {
    const state = ivrsReducer(initialState, ivrsActions.openCreateModal());
    expect(state.isModalOpen).toBe(true);
    expect(state.selectedIvr).toBeNull();
    expect(state.modalMode).toBe('create');
  });

  it('should handle openEditModal', () => {
    const state = ivrsReducer(initialState, ivrsActions.openEditModal(mockIvr));
    expect(state.isModalOpen).toBe(true);
    expect(state.selectedIvr).toEqual(mockIvr);
    expect(state.modalMode).toBe('edit');
  });

  it('should handle closeModal', () => {
    const openState: IvrsSchema = {
      isModalOpen: true,
      selectedIvr: mockIvr,
      modalMode: 'edit',
    };
    const state = ivrsReducer(openState, ivrsActions.closeModal());
    expect(state.isModalOpen).toBe(false);
    expect(state.selectedIvr).toBeNull();
  });
});
