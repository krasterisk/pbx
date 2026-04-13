import { describe, it, expect } from 'vitest';
import { contextsReducer, contextsActions } from './contextsSlice';
import type { ContextsSchema } from '../types/contextsSchema';
import type { IContext } from '@/shared/api/api';

const mockContext: IContext = { uid: 1, name: 'default' };

describe('contextsSlice', () => {
  const initialState: ContextsSchema = {
    isModalOpen: false,
    selectedContext: null,
  };

  it('should return initial state', () => {
    expect(contextsReducer(undefined, { type: 'unknown' })).toEqual(initialState);
  });

  it('should handle openCreateModal', () => {
    const state = contextsReducer(initialState, contextsActions.openCreateModal());
    expect(state.isModalOpen).toBe(true);
    expect(state.selectedContext).toBeNull();
  });

  it('should handle openEditModal', () => {
    const state = contextsReducer(initialState, contextsActions.openEditModal(mockContext));
    expect(state.isModalOpen).toBe(true);
    expect(state.selectedContext).toEqual(mockContext);
  });

  it('should handle closeModal', () => {
    const openState: ContextsSchema = {
      isModalOpen: true,
      selectedContext: mockContext,
    };
    const state = contextsReducer(openState, contextsActions.closeModal());
    expect(state.isModalOpen).toBe(false);
    expect(state.selectedContext).toBeNull();
  });
});
