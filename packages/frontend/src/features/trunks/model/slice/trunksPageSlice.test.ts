import { describe, it, expect } from 'vitest';
import { trunksPageReducer, trunksPageActions } from './trunksPageSlice';
import type { TrunksPageSchema } from './trunksPageSlice';

const mockTrunk = { id: 1, name: 'sip-provider', username: 'user1', auth_type: 'userpass' } as any;

describe('trunksPageSlice', () => {
  const initialState: TrunksPageSchema = {
    isModalOpen: false,
    selectedTrunk: null,
    modalMode: 'create',
  };

  it('should handle openCopyModal', () => {
    const state = trunksPageReducer(initialState, trunksPageActions.openCopyModal(mockTrunk));
    expect(state.isModalOpen).toBe(true);
    expect(state.modalMode).toBe('copy');
    expect(state.selectedTrunk).toEqual(mockTrunk);
  });

  it('should handle openEditModal', () => {
    const state = trunksPageReducer(initialState, trunksPageActions.openEditModal(mockTrunk));
    expect(state.isModalOpen).toBe(true);
    expect(state.modalMode).toBe('edit');
    expect(state.selectedTrunk).toEqual(mockTrunk);
  });
});
