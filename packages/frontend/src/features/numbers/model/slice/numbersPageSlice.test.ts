import { describe, it, expect } from 'vitest';
import { numbersPageReducer, numbersPageActions } from './numbersPageSlice';
import type { NumbersPageSchema } from '../types/numbersPageSchema';
import type { INumberList } from '@/shared/api/api';

const mockNumber = {
  id: 1,
  name: 'List A',
} as INumberList;

describe('numbersPageSlice', () => {
  const initialState: NumbersPageSchema = {
    isModalOpen: false,
    selectedNumber: null,
    modalMode: 'create',
  };

  it('should return initial state', () => {
    expect(numbersPageReducer(undefined, { type: 'unknown' })).toEqual(initialState);
  });

  it('should handle openCreateModal', () => {
    const state = numbersPageReducer(initialState, numbersPageActions.openCreateModal());
    expect(state.isModalOpen).toBe(true);
    expect(state.selectedNumber).toBeNull();
    expect(state.modalMode).toBe('create');
  });

  it('should handle openEditModal', () => {
    const state = numbersPageReducer(initialState, numbersPageActions.openEditModal(mockNumber));
    expect(state.isModalOpen).toBe(true);
    expect(state.selectedNumber).toEqual(mockNumber);
    expect(state.modalMode).toBe('edit');
  });

  it('should handle closeModal', () => {
    const openState: NumbersPageSchema = {
      isModalOpen: true,
      selectedNumber: mockNumber,
      modalMode: 'edit',
    };
    const state = numbersPageReducer(openState, numbersPageActions.closeModal());
    expect(state.isModalOpen).toBe(false);
    expect(state.selectedNumber).toBeNull();
  });
});
