import { describe, it, expect } from 'vitest';
import { phonebooksReducer, phonebooksActions } from './phonebooksSlice';
import type { PhonebooksState } from './phonebooksSlice';

const mockPhonebook = {
  uid: 1,
  name: 'VIP-клиенты',
  description: 'Приоритетные клиенты',
  invert: false,
  actions: [{ type: 'hangup', params: {} }],
  user_uid: 100,
} as any;

describe('phonebooksSlice', () => {
  const initialState: PhonebooksState = {
    modalOpen: false,
    modalMode: 'create',
    editingItem: null,
    selectedIds: [],
  };

  // ═══════════════════════════════════════════════════════════
  // Modal actions
  // ═══════════════════════════════════════════════════════════

  describe('modal actions', () => {
    it('should handle openCreateModal', () => {
      const state = phonebooksReducer(initialState, phonebooksActions.openCreateModal());
      expect(state.modalOpen).toBe(true);
      expect(state.modalMode).toBe('create');
      expect(state.editingItem).toBeNull();
    });

    it('should handle openEditModal', () => {
      const state = phonebooksReducer(initialState, phonebooksActions.openEditModal(mockPhonebook));
      expect(state.modalOpen).toBe(true);
      expect(state.modalMode).toBe('edit');
      expect(state.editingItem).toEqual(mockPhonebook);
    });

    it('should handle openCopyModal', () => {
      const state = phonebooksReducer(initialState, phonebooksActions.openCopyModal(mockPhonebook));
      expect(state.modalOpen).toBe(true);
      expect(state.modalMode).toBe('copy');
      expect(state.editingItem).toEqual(mockPhonebook);
    });

    it('should handle closeModal', () => {
      // Start with open modal
      const openState: PhonebooksState = {
        ...initialState,
        modalOpen: true,
        modalMode: 'edit',
        editingItem: mockPhonebook,
      };
      const state = phonebooksReducer(openState, phonebooksActions.closeModal());
      expect(state.modalOpen).toBe(false);
      expect(state.editingItem).toBeNull();
    });

    it('should preserve selectedIds when closing modal', () => {
      const stateWithIds: PhonebooksState = {
        ...initialState,
        modalOpen: true,
        selectedIds: [1, 2, 3],
      };
      const state = phonebooksReducer(stateWithIds, phonebooksActions.closeModal());
      expect(state.selectedIds).toEqual([1, 2, 3]);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Selection actions
  // ═══════════════════════════════════════════════════════════

  describe('selection actions', () => {
    it('should handle setSelectedIds', () => {
      const state = phonebooksReducer(initialState, phonebooksActions.setSelectedIds([1, 2, 3]));
      expect(state.selectedIds).toEqual([1, 2, 3]);
    });

    it('should handle clearSelection', () => {
      const stateWithSelection: PhonebooksState = {
        ...initialState,
        selectedIds: [1, 2, 3],
      };
      const state = phonebooksReducer(stateWithSelection, phonebooksActions.clearSelection());
      expect(state.selectedIds).toEqual([]);
    });

    it('should replace selectedIds on set', () => {
      const stateWithSelection: PhonebooksState = {
        ...initialState,
        selectedIds: [1, 2],
      };
      const state = phonebooksReducer(stateWithSelection, phonebooksActions.setSelectedIds([5, 6, 7]));
      expect(state.selectedIds).toEqual([5, 6, 7]);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // State transitions
  // ═══════════════════════════════════════════════════════════

  describe('state transitions', () => {
    it('should transition from edit → create without leftover data', () => {
      const editState: PhonebooksState = {
        ...initialState,
        modalOpen: true,
        modalMode: 'edit',
        editingItem: mockPhonebook,
      };
      // Close then open create
      let state = phonebooksReducer(editState, phonebooksActions.closeModal());
      state = phonebooksReducer(state, phonebooksActions.openCreateModal());
      expect(state.modalMode).toBe('create');
      expect(state.editingItem).toBeNull();
    });
  });
});
