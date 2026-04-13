import { describe, it, expect } from 'vitest';
import { provisionTemplatesReducer, provisionTemplatesActions } from './provisionTemplatesSlice';
import type { ProvisionTemplatesSchema } from '../types/provisionTemplatesSchema';

const mockTemplate = { uid: 1, name: 'T21', code: 'test code', tenant_id: 1 };

describe('provisionTemplatesSlice', () => {
  const initialState: ProvisionTemplatesSchema = {
    isModalOpen: false,
    selectedTemplate: null,
  };

  it('should return initial state', () => {
    expect(provisionTemplatesReducer(undefined, { type: 'unknown' })).toEqual(initialState);
  });

  it('should handle openCreateModal', () => {
    const state = provisionTemplatesReducer(initialState, provisionTemplatesActions.openCreateModal());
    expect(state.isModalOpen).toBe(true);
    expect(state.selectedTemplate).toBeNull();
  });

  it('should handle openEditModal', () => {
    const state = provisionTemplatesReducer(initialState, provisionTemplatesActions.openEditModal(mockTemplate));
    expect(state.isModalOpen).toBe(true);
    expect(state.selectedTemplate).toEqual(mockTemplate);
  });
});
