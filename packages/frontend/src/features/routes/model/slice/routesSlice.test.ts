import { describe, it, expect } from 'vitest';
import { routesReducer, routesActions } from './routesSlice';
import type { RoutesSchema } from '../types/routesSchema';

const mockRoute = { uid: 1, context_id: 1, exten: '100', priority: 1, app: 'Dial', target: 'PJSIP/100' } as any;

describe('routesSlice', () => {
  const initialState: RoutesSchema = {
    isModalOpen: false,
    modalMode: 'create',
    selectedRoute: null,
    selectedContextUid: null,
    editorMode: 'table',
  };

  it('should handle selectContext', () => {
    const state = routesReducer(initialState, routesActions.selectContext(2));
    expect(state.selectedContextUid).toBe(2);
  });

  it('should handle setEditorMode', () => {
    const state = routesReducer(initialState, routesActions.setEditorMode('raw'));
    expect(state.editorMode).toBe('raw');
  });

  it('should handle openEditModal', () => {
    const state = routesReducer(initialState, routesActions.openEditModal(mockRoute));
    expect(state.isModalOpen).toBe(true);
    expect(state.selectedRoute).toEqual(mockRoute);
    expect(state.modalMode).toBe('edit');
  });

  it('should handle openCopyModal', () => {
    const state = routesReducer(initialState, routesActions.openCopyModal(mockRoute));
    expect(state.isModalOpen).toBe(true);
    expect(state.selectedRoute).toEqual(mockRoute);
    expect(state.modalMode).toBe('copy');
  });
});
