import { describe, it, expect } from 'vitest';
import type { IDirectory } from '@krasterisk/shared';
import { directoriesReducer, directoriesActions } from './directoriesSlice';
import type { DirectoriesState } from './directoriesSlice';

const mockDirectory: IDirectory = {
  uid: 1,
  user_uid: 100,
  name: 'VIP clients',
  description: 'Priority clients',
  lookup_field_uid: 10,
  key_normalization: 'digits',
  revision: 1,
};

describe('directoriesSlice', () => {
  const initialState: DirectoriesState = {
    modalOpen: false,
    modalMode: 'create',
    editingItem: null,
    selectedIds: [],
  };

  describe('modal actions', () => {
    it('should handle openCreateModal', () => {
      const state = directoriesReducer(initialState, directoriesActions.openCreateModal());
      expect(state.modalOpen).toBe(true);
      expect(state.modalMode).toBe('create');
      expect(state.editingItem).toBeNull();
    });

    it('should handle openEditModal with IDirectory', () => {
      const state = directoriesReducer(initialState, directoriesActions.openEditModal(mockDirectory));
      expect(state.modalOpen).toBe(true);
      expect(state.modalMode).toBe('edit');
      expect(state.editingItem).toEqual(mockDirectory);
      expect(state.editingItem?.lookup_field_uid).toBe(10);
      expect(state.editingItem?.key_normalization).toBe('digits');
    });

    it('should handle openCopyModal with IDirectory', () => {
      const state = directoriesReducer(initialState, directoriesActions.openCopyModal(mockDirectory));
      expect(state.modalOpen).toBe(true);
      expect(state.modalMode).toBe('copy');
      expect(state.editingItem).toEqual(mockDirectory);
    });

    it('should handle closeModal', () => {
      const openState: DirectoriesState = {
        ...initialState,
        modalOpen: true,
        modalMode: 'edit',
        editingItem: mockDirectory,
      };
      const state = directoriesReducer(openState, directoriesActions.closeModal());
      expect(state.modalOpen).toBe(false);
      expect(state.editingItem).toBeNull();
    });

    it('should preserve selectedIds when closing modal', () => {
      const stateWithIds: DirectoriesState = {
        ...initialState,
        modalOpen: true,
        selectedIds: [1, 2, 3],
      };
      const state = directoriesReducer(stateWithIds, directoriesActions.closeModal());
      expect(state.selectedIds).toEqual([1, 2, 3]);
    });
  });

  describe('selection actions', () => {
    it('should handle setSelectedIds', () => {
      const state = directoriesReducer(initialState, directoriesActions.setSelectedIds([1, 2, 3]));
      expect(state.selectedIds).toEqual([1, 2, 3]);
    });

    it('should handle clearSelection', () => {
      const stateWithSelection: DirectoriesState = {
        ...initialState,
        selectedIds: [1, 2, 3],
      };
      const state = directoriesReducer(stateWithSelection, directoriesActions.clearSelection());
      expect(state.selectedIds).toEqual([]);
    });

    it('should replace selectedIds on set', () => {
      const stateWithSelection: DirectoriesState = {
        ...initialState,
        selectedIds: [1, 2],
      };
      const state = directoriesReducer(stateWithSelection, directoriesActions.setSelectedIds([5, 6, 7]));
      expect(state.selectedIds).toEqual([5, 6, 7]);
    });
  });

  describe('state transitions', () => {
    it('should transition from edit to create without leftover data', () => {
      const editState: DirectoriesState = {
        ...initialState,
        modalOpen: true,
        modalMode: 'edit',
        editingItem: mockDirectory,
      };
      let state = directoriesReducer(editState, directoriesActions.closeModal());
      state = directoriesReducer(state, directoriesActions.openCreateModal());
      expect(state.modalMode).toBe('create');
      expect(state.editingItem).toBeNull();
    });
  });
});
