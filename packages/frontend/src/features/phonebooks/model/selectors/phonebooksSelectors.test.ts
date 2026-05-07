import { describe, it, expect } from 'vitest';
import {
  getPhonebooksModalOpen,
  getPhonebooksModalMode,
  getPhonebooksEditingItem,
  getPhonebooksSelectedIds,
} from './phonebooksSelectors';

const mockPhonebook = {
  uid: 5,
  name: 'Blacklist',
  invert: false,
  actions: [],
  user_uid: 1,
} as any;

describe('phonebooksSelectors', () => {
  const createState = (overrides: Partial<any> = {}) => ({
    phonebooks: {
      modalOpen: false,
      modalMode: 'create' as const,
      editingItem: null,
      selectedIds: [],
      ...overrides,
    },
  }) as any;

  it('getPhonebooksModalOpen should return modalOpen', () => {
    expect(getPhonebooksModalOpen(createState({ modalOpen: true }))).toBe(true);
    expect(getPhonebooksModalOpen(createState({ modalOpen: false }))).toBe(false);
  });

  it('getPhonebooksModalMode should return modalMode', () => {
    expect(getPhonebooksModalMode(createState({ modalMode: 'edit' }))).toBe('edit');
    expect(getPhonebooksModalMode(createState({ modalMode: 'copy' }))).toBe('copy');
  });

  it('getPhonebooksEditingItem should return editingItem', () => {
    expect(getPhonebooksEditingItem(createState({ editingItem: mockPhonebook }))).toEqual(mockPhonebook);
    expect(getPhonebooksEditingItem(createState())).toBeNull();
  });

  it('getPhonebooksSelectedIds should return selectedIds', () => {
    expect(getPhonebooksSelectedIds(createState({ selectedIds: [1, 2, 3] }))).toEqual([1, 2, 3]);
    expect(getPhonebooksSelectedIds(createState())).toEqual([]);
  });
});
