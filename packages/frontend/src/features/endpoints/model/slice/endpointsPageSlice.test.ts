import { describe, it, expect } from 'vitest';
import { endpointsPageReducer, endpointsPageActions } from './endpointsPageSlice';
import type { EndpointsPageSchema } from './endpointsPageSlice';

const mockEndpoint = { id: 1, name: '100', sip_id: 'sip1', caller_id: 'User 1' } as any;

describe('endpointsPageSlice', () => {
  const initialState: EndpointsPageSchema = {
    isModalOpen: false,
    isBulkModalOpen: false,
    selectedEndpoint: null,
    modalMode: 'create',
    credentialsSipId: null,
  };

  it('should return initial state', () => {
    expect(endpointsPageReducer(undefined, { type: 'unknown' })).toEqual(initialState);
  });

  it('should handle openCreateModal', () => {
    const state = endpointsPageReducer(initialState, endpointsPageActions.openCreateModal());
    expect(state.isModalOpen).toBe(true);
    expect(state.modalMode).toBe('create');
  });

  it('should handle openEditModal', () => {
    const state = endpointsPageReducer(initialState, endpointsPageActions.openEditModal(mockEndpoint));
    expect(state.isModalOpen).toBe(true);
    expect(state.modalMode).toBe('edit');
    expect(state.selectedEndpoint).toEqual(mockEndpoint);
  });

  it('should handle credentials modal', () => {
    const state = endpointsPageReducer(initialState, endpointsPageActions.openCredentialsModal('sip1'));
    expect(state.credentialsSipId).toBe('sip1');
    const closedState = endpointsPageReducer(state, endpointsPageActions.closeCredentialsModal());
    expect(closedState.credentialsSipId).toBeNull();
  });
});
