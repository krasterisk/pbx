import { describe, it, expect } from 'vitest';
import type { IDirectory } from '@krasterisk/shared';
import {
  getDirectoriesModalOpen,
  getDirectoriesModalMode,
  getDirectoriesEditingItem,
  getDirectoriesSelectedIds,
} from './directoriesSelectors';

const mockDirectory: IDirectory = {
  uid: 5,
  user_uid: 1,
  name: 'Blacklist',
  lookup_field_uid: 20,
  key_normalization: 'none',
  revision: 2,
};

describe('directoriesSelectors', () => {
  const createState = (overrides: Partial<{
    modalOpen: boolean;
    modalMode: 'create' | 'edit' | 'copy';
    editingItem: IDirectory | null;
    selectedIds: number[];
  }> = {}) => ({
    directories: {
      modalOpen: false,
      modalMode: 'create' as const,
      editingItem: null,
      selectedIds: [],
      ...overrides,
    },
  }) as any;

  it('getDirectoriesModalOpen should return modalOpen', () => {
    expect(getDirectoriesModalOpen(createState({ modalOpen: true }))).toBe(true);
    expect(getDirectoriesModalOpen(createState({ modalOpen: false }))).toBe(false);
  });

  it('getDirectoriesModalMode should return modalMode', () => {
    expect(getDirectoriesModalMode(createState({ modalMode: 'edit' }))).toBe('edit');
    expect(getDirectoriesModalMode(createState({ modalMode: 'copy' }))).toBe('copy');
  });

  it('getDirectoriesEditingItem should return IDirectory or null', () => {
    expect(getDirectoriesEditingItem(createState({ editingItem: mockDirectory }))).toEqual(mockDirectory);
    expect(getDirectoriesEditingItem(createState())).toBeNull();
  });

  it('getDirectoriesSelectedIds should return selectedIds', () => {
    expect(getDirectoriesSelectedIds(createState({ selectedIds: [1, 2, 3] }))).toEqual([1, 2, 3]);
    expect(getDirectoriesSelectedIds(createState())).toEqual([]);
  });
});
