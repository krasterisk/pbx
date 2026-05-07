import { describe, it, expect } from 'vitest';
import { routesReducer, routesActions } from './routesSlice';
import type { RoutesSchema } from '../types/routesSchema';

const mockRoute = { uid: 1, context_id: 1, exten: '100', priority: 1, app: 'Dial', target: 'PJSIP/100' } as any;
const mockRoute2 = { uid: 2, context_id: 2, exten: '200', priority: 1, app: 'Hangup', target: '' } as any;

describe('routesSlice', () => {
  const initialState: RoutesSchema = {
    isModalOpen: false,
    modalMode: 'create',
    selectedRoute: null,
    selectedContextUids: [],
    editorMode: 'table',
  };

  // ═══════════════════════════════════════════════════════════
  // Context filter
  // ═══════════════════════════════════════════════════════════

  describe('context filter', () => {
    it('should handle setContextFilter', () => {
      const state = routesReducer(initialState, routesActions.setContextFilter([2, 3]));
      expect(state.selectedContextUids).toEqual([2, 3]);
    });

    it('should replace existing filter', () => {
      const stateWithFilter = { ...initialState, selectedContextUids: [1, 2] };
      const state = routesReducer(stateWithFilter, routesActions.setContextFilter([5]));
      expect(state.selectedContextUids).toEqual([5]);
    });

    it('should handle empty filter', () => {
      const stateWithFilter = { ...initialState, selectedContextUids: [1, 2] };
      const state = routesReducer(stateWithFilter, routesActions.setContextFilter([]));
      expect(state.selectedContextUids).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Editor mode
  // ═══════════════════════════════════════════════════════════

  describe('editor mode', () => {
    it('should handle setEditorMode to raw', () => {
      const state = routesReducer(initialState, routesActions.setEditorMode('raw'));
      expect(state.editorMode).toBe('raw');
    });

    it('should handle setEditorMode back to table', () => {
      const rawState = { ...initialState, editorMode: 'raw' as const };
      const state = routesReducer(rawState, routesActions.setEditorMode('table'));
      expect(state.editorMode).toBe('table');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Modal actions
  // ═══════════════════════════════════════════════════════════

  describe('modal actions', () => {
    it('should handle openCreateModal', () => {
      const state = routesReducer(initialState, routesActions.openCreateModal());
      expect(state.isModalOpen).toBe(true);
      expect(state.modalMode).toBe('create');
      expect(state.selectedRoute).toBeNull();
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

    it('should handle closeModal', () => {
      const openState: RoutesSchema = {
        ...initialState,
        isModalOpen: true,
        modalMode: 'edit',
        selectedRoute: mockRoute,
      };
      const state = routesReducer(openState, routesActions.closeModal());
      expect(state.isModalOpen).toBe(false);
      expect(state.selectedRoute).toBeNull();
    });

    it('should clear selectedRoute on openCreateModal', () => {
      const editState: RoutesSchema = {
        ...initialState,
        selectedRoute: mockRoute,
      };
      const state = routesReducer(editState, routesActions.openCreateModal());
      expect(state.selectedRoute).toBeNull();
    });

    it('should preserve contextFilter when opening modal', () => {
      const stateWithFilter: RoutesSchema = {
        ...initialState,
        selectedContextUids: [1, 2, 3],
      };
      const state = routesReducer(stateWithFilter, routesActions.openEditModal(mockRoute));
      expect(state.selectedContextUids).toEqual([1, 2, 3]);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // State transitions
  // ═══════════════════════════════════════════════════════════

  describe('state transitions', () => {
    it('should transition edit → close → create without leftover route', () => {
      let state = routesReducer(initialState, routesActions.openEditModal(mockRoute));
      expect(state.selectedRoute).toEqual(mockRoute);

      state = routesReducer(state, routesActions.closeModal());
      state = routesReducer(state, routesActions.openCreateModal());

      expect(state.modalMode).toBe('create');
      expect(state.selectedRoute).toBeNull();
    });

    it('should allow switching from edit to copy', () => {
      let state = routesReducer(initialState, routesActions.openEditModal(mockRoute));
      state = routesReducer(state, routesActions.closeModal());
      state = routesReducer(state, routesActions.openCopyModal(mockRoute2));

      expect(state.modalMode).toBe('copy');
      expect(state.selectedRoute).toEqual(mockRoute2);
    });
  });
});
