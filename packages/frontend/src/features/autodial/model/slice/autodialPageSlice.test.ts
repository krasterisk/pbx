import { describe, expect, it } from 'vitest';
import { autodialPageActions as actions, autodialPageReducer as reducer } from './autodialPageSlice';

describe('autodial page identities', () => {
  it('editing a base does not select it or redirect an open import', () => {
    let state = reducer(undefined, actions.selectBase(1));
    state = reducer(state, actions.openImport());
    state = reducer(state, actions.openEditBase(2));
    expect(state).toMatchObject({ activeBaseUid: 1, selectedBaseUid: 2, isImportOpen: true });
  });
  it('changing the base closes contact/import sessions', () => {
    let state = reducer(undefined, actions.selectBase(1));
    state = reducer(state, actions.openImport());
    state = reducer(state, actions.openEditContact(61));
    state = reducer(state, actions.selectBase(2));
    expect(state).toMatchObject({ activeBaseUid: 2, isImportOpen: false, isContactModalOpen: false, selectedContactUid: null });
  });
  it('resets the base edit identity for create and close', () => {
    let state = reducer(undefined, actions.openEditBase(2));
    state = reducer(state, actions.closeBaseModal());
    expect(state.selectedBaseUid).toBeNull();
    state = reducer(state, actions.openCreateBase());
    expect(state).toMatchObject({ selectedBaseUid: null, baseModalMode: 'create' });
  });
});
