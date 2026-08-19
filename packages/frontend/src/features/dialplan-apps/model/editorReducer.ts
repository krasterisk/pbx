import type { ActionType, IRouteAction } from '@krasterisk/shared';
import { pasteStep } from './clipboard';

export const REMOVED_STACK_LIMIT = 20;

export type ChainAction = IRouteAction & { enabled?: boolean };

export interface RemovedEntry {
  action: ChainAction;
  index: number;
}

export interface EditorState {
  actions: ChainAction[];
  removedStack: RemovedEntry[];
  selectedStepId: string | null;
}

export type EditorAction =
  | { type: 'hydrate'; actions: ChainAction[] }
  | { type: 'add'; action?: Partial<ChainAction> }
  | { type: 'remove'; id: string }
  | { type: 'undoRemove' }
  | { type: 'duplicate'; id: string }
  | { type: 'toggleEnabled'; id: string }
  | { type: 'insertAt'; index: number; action: ChainAction }
  | { type: 'paste'; index: number }
  | { type: 'patchParams'; id: string; patch: Record<string, unknown> }
  | { type: 'setType'; id: string; actionType: ActionType; defaultParams?: Record<string, unknown> }
  | { type: 'move'; from: number; to: number }
  | { type: 'select'; id: string | null };

const defaultMakeId = (): string => crypto.randomUUID();

export function createEditorState(actions: ChainAction[] = []): EditorState {
  return {
    actions,
    removedStack: [],
    selectedStepId: null,
  };
}

function clampIndex(index: number, length: number): number {
  if (Number.isNaN(index)) return length;
  return Math.min(Math.max(index, 0), length);
}

function cloneAction(action: ChainAction, id: string): ChainAction {
  return {
    ...structuredClone(action),
    id,
  };
}

function pushRemoved(stack: RemovedEntry[], entry: RemovedEntry): RemovedEntry[] {
  const next = [...stack, entry];
  if (next.length <= REMOVED_STACK_LIMIT) return next;
  return next.slice(next.length - REMOVED_STACK_LIMIT);
}

export function editorReducer(
  state: EditorState,
  action: EditorAction,
  makeId: () => string = defaultMakeId,
): EditorState {
  switch (action.type) {
    case 'hydrate':
      return {
        actions: action.actions,
        removedStack: [],
        selectedStepId: state.selectedStepId,
      };

    case 'add': {
      const nextAction: ChainAction = {
        id: makeId(),
        type: (action.action?.type ?? 'hangup') as ActionType,
        params: { ...(action.action?.params ?? {}) },
        condition: { ...(action.action?.condition ?? {}) },
        enabled: action.action?.enabled ?? true,
      };
      return {
        ...state,
        actions: [...state.actions, nextAction],
      };
    }

    case 'remove': {
      const index = state.actions.findIndex((item) => item.id === action.id);
      if (index === -1) return state;
      const removed = state.actions[index];
      return {
        ...state,
        actions: state.actions.filter((_, i) => i !== index),
        removedStack: pushRemoved(state.removedStack, { action: removed, index }),
        selectedStepId: state.selectedStepId === action.id ? null : state.selectedStepId,
      };
    }

    case 'undoRemove': {
      if (state.removedStack.length === 0) return state;
      const stack = state.removedStack.slice();
      const entry = stack.pop()!;
      const index = clampIndex(entry.index, state.actions.length);
      const actions = state.actions.slice();
      actions.splice(index, 0, entry.action);
      return {
        ...state,
        actions,
        removedStack: stack,
      };
    }

    case 'duplicate': {
      const index = state.actions.findIndex((item) => item.id === action.id);
      if (index === -1) return state;
      const copy = cloneAction(state.actions[index], makeId());
      const actions = state.actions.slice();
      actions.splice(index + 1, 0, copy);
      return { ...state, actions };
    }

    case 'toggleEnabled': {
      const index = state.actions.findIndex((item) => item.id === action.id);
      if (index === -1) return state;
      const current = state.actions[index];
      const actions = state.actions.slice();
      actions[index] = { ...current, enabled: !(current.enabled ?? true) };
      return { ...state, actions };
    }

    case 'insertAt': {
      const index = clampIndex(action.index, state.actions.length);
      const actions = state.actions.slice();
      actions.splice(index, 0, action.action);
      return { ...state, actions };
    }

    case 'paste': {
      const pasted = pasteStep(makeId);
      if (!pasted) return state;
      const index = clampIndex(action.index, state.actions.length);
      const actions = state.actions.slice();
      actions.splice(index, 0, pasted);
      return { ...state, actions };
    }

    case 'patchParams': {
      const index = state.actions.findIndex((item) => item.id === action.id);
      if (index === -1) return state;
      const current = state.actions[index];
      const actions = state.actions.slice();
      actions[index] = {
        ...current,
        params: { ...current.params, ...action.patch },
      };
      return { ...state, actions };
    }

    case 'setType': {
      const index = state.actions.findIndex((item) => item.id === action.id);
      if (index === -1) return state;
      const current = state.actions[index];
      const actions = state.actions.slice();
      actions[index] = {
        ...current,
        type: action.actionType,
        params: { ...(action.defaultParams ?? {}) },
      };
      return { ...state, actions };
    }

    case 'move': {
      const from = clampIndex(action.from, state.actions.length - 1);
      const to = clampIndex(action.to, state.actions.length - 1);
      if (from === to) return state;
      const actions = state.actions.slice();
      const [moved] = actions.splice(from, 1);
      actions.splice(to, 0, moved);
      return { ...state, actions };
    }

    case 'select':
      return { ...state, selectedStepId: action.id };

    default:
      return state;
  }
}
