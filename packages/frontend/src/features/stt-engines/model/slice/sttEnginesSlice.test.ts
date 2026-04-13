import { describe, it, expect } from 'vitest';
import { sttEnginesReducer, sttEnginesActions } from './sttEnginesSlice';
import type { SttEnginesSchema } from '../types/sttEnginesSchema';
import type { ISttEngine } from '@/entities/engines';

const mockEngine: ISttEngine = {
  uid: 1,
  name: 'Google Voice Rec',
  type: 'google',
} as ISttEngine;

describe('sttEnginesSlice', () => {
  const initialState: SttEnginesSchema = {
    isModalOpen: false,
    selectedEngine: null,
    modalMode: 'create',
  };

  it('should return initial state', () => {
    expect(sttEnginesReducer(undefined, { type: 'unknown' })).toEqual(initialState);
  });

  it('should handle openCreateModal', () => {
    const state = sttEnginesReducer(initialState, sttEnginesActions.openCreateModal());
    expect(state.isModalOpen).toBe(true);
    expect(state.selectedEngine).toBeNull();
    expect(state.modalMode).toBe('create');
  });

  it('should handle openEditModal', () => {
    const state = sttEnginesReducer(initialState, sttEnginesActions.openEditModal(mockEngine));
    expect(state.isModalOpen).toBe(true);
    expect(state.selectedEngine).toEqual(mockEngine);
    expect(state.modalMode).toBe('edit');
  });

  it('should handle closeModal', () => {
    const openState: SttEnginesSchema = {
      isModalOpen: true,
      selectedEngine: mockEngine,
      modalMode: 'edit',
    };
    const state = sttEnginesReducer(openState, sttEnginesActions.closeModal());
    expect(state.isModalOpen).toBe(false);
    expect(state.selectedEngine).toBeNull();
  });
});
