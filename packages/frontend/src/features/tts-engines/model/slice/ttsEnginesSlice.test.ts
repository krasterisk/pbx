import { describe, it, expect } from 'vitest';
import { ttsEnginesReducer, ttsEnginesActions } from './ttsEnginesSlice';
import type { TtsEnginesSchema } from '../types/ttsEnginesSchema';
import type { ITtsEngine } from '@/entities/engines';

const mockEngine: ITtsEngine = {
  uid: 1,
  name: 'Google Voice',
  type: 'google',
} as ITtsEngine;

describe('ttsEnginesSlice', () => {
  const initialState: TtsEnginesSchema = {
    isModalOpen: false,
    selectedEngine: null,
    modalMode: 'create',
  };

  it('should return initial state', () => {
    expect(ttsEnginesReducer(undefined, { type: 'unknown' })).toEqual(initialState);
  });

  it('should handle openCreateModal', () => {
    const state = ttsEnginesReducer(initialState, ttsEnginesActions.openCreateModal());
    expect(state.isModalOpen).toBe(true);
    expect(state.selectedEngine).toBeNull();
    expect(state.modalMode).toBe('create');
  });

  it('should handle openEditModal', () => {
    const state = ttsEnginesReducer(initialState, ttsEnginesActions.openEditModal(mockEngine));
    expect(state.isModalOpen).toBe(true);
    expect(state.selectedEngine).toEqual(mockEngine);
    expect(state.modalMode).toBe('edit');
  });

  it('should handle closeModal', () => {
    const openState: TtsEnginesSchema = {
      isModalOpen: true,
      selectedEngine: mockEngine,
      modalMode: 'edit',
    };
    const state = ttsEnginesReducer(openState, ttsEnginesActions.closeModal());
    expect(state.isModalOpen).toBe(false);
    expect(state.selectedEngine).toBeNull();
  });
});
