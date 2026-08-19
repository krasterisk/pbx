import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeEach } from 'vitest';
import type { IRouteAction } from '@krasterisk/shared';
import {
  REMOVED_STACK_LIMIT,
  createEditorState,
  editorReducer,
  type ChainAction,
  type EditorState,
} from './editorReducer';
import { copyStep, peekStep, resetClipboard } from './clipboard';

const specDir = dirname(fileURLToPath(import.meta.url));

function step(id: string, extras: Partial<ChainAction> = {}): ChainAction {
  const { params, condition, enabled, ...rest } = extras;
  return {
    id,
    type: 'hangup',
    params: { ...(params ?? {}) },
    condition: condition ?? {},
    enabled: enabled ?? true,
    ...rest,
  };
}

function reduce(state: EditorState, action: Parameters<typeof editorReducer>[1], makeId = () => 'new-id') {
  return editorReducer(state, action, makeId);
}

describe('editorReducer', () => {
  let initial: EditorState;

  beforeEach(() => {
    resetClipboard();
    initial = createEditorState([step('a'), step('b', { params: { reason: 'busy' } }), step('c')]);
  });

  it('restores a step removed from index 1 back to index 1', () => {
    const afterRemove = reduce(initial, { type: 'remove', id: 'b' });
    expect(afterRemove.actions.map((a) => a.id)).toEqual(['a', 'c']);

    const afterUndo = reduce(afterRemove, { type: 'undoRemove' });
    expect(afterUndo.actions.findIndex((a) => a.id === 'b')).toBe(1);
    expect(afterUndo.actions.map((a) => a.id)).toEqual(['a', 'b', 'c']);
  });

  it('restores two sequential removals in original order via stacked undoRemove', () => {
    const afterFirst = reduce(initial, { type: 'remove', id: 'a' });
    const afterSecond = reduce(afterFirst, { type: 'remove', id: 'c' });

    const undoOnce = reduce(afterSecond, { type: 'undoRemove' });
    const undoTwice = reduce(undoOnce, { type: 'undoRemove' });

    expect(undoTwice.actions.map((a) => a.id)).toEqual(['a', 'b', 'c']);
    expect(undoTwice.actions).toEqual(initial.actions);
  });

  it('returns the same state reference when undoRemove runs on an empty stack', () => {
    const next = reduce(initial, { type: 'undoRemove' });
    expect(next).toBe(initial);
  });

  it('returns the same state reference on a second undoRemove after a single remove', () => {
    const afterRemove = reduce(initial, { type: 'remove', id: 'b' });
    const afterUndo = reduce(afterRemove, { type: 'undoRemove' });
    const again = reduce(afterUndo, { type: 'undoRemove' });
    expect(again).toBe(afterUndo);
  });

  it('duplicates immediately after the original with a new id and cloned params', () => {
    let seq = 0;
    const makeId = () => `dup-${++seq}`;
    const next = reduce(initial, { type: 'duplicate', id: 'b' }, makeId);
    const ids = next.actions.map((a) => a.id);

    expect(ids).toEqual(['a', 'b', 'dup-1', 'c']);
    expect(next.actions[2].id).not.toBe('b');
    expect(next.actions[2].params).toEqual(initial.actions[1].params);
    expect(next.actions[2].params).not.toBe(initial.actions[1].params);
  });

  it('toggleEnabled flips the flag without reordering or dropping params', () => {
    const next = reduce(initial, { type: 'toggleEnabled', id: 'b' });
    expect(next.actions.map((a) => a.id)).toEqual(['a', 'b', 'c']);
    expect(next.actions[1].enabled).toBe(false);
    expect(next.actions[1].params).toEqual({ reason: 'busy' });

    const back = reduce(next, { type: 'toggleEnabled', id: 'b' });
    expect(back.actions[1].enabled).toBe(true);
    expect(back.actions[1].params).toEqual({ reason: 'busy' });
  });

  it('insertAt clamps out-of-range indexes instead of leaving a hole', () => {
    const extra = step('x');
    const tooHigh = reduce(initial, { type: 'insertAt', index: 99, action: extra });
    expect(tooHigh.actions.map((a) => a.id)).toEqual(['a', 'b', 'c', 'x']);

    const tooLow = reduce(initial, { type: 'insertAt', index: -4, action: extra });
    expect(tooLow.actions.map((a) => a.id)).toEqual(['x', 'a', 'b', 'c']);
  });

  it('paste with an empty clipboard is a no-op by reference', () => {
    const next = reduce(initial, { type: 'paste', index: 1 });
    expect(next).toBe(initial);
  });

  it('paste inserts a deep copy so mutating the new step does not change the clipboard source', () => {
    copyStep(initial.actions[1]);
    let seq = 0;
    const next = reduce(initial, { type: 'paste', index: 2 }, () => `pasted-${++seq}`);
    expect(next.actions.map((a) => a.id)).toEqual(['a', 'b', 'pasted-1', 'c']);

    (next.actions[2].params as { reason?: string }).reason = 'mutated';
    expect(peekStep()?.params).toEqual({ reason: 'busy' });
  });

  it('caps removedStack at 20 after 25 deletions', () => {
    const many = createEditorState(
      Array.from({ length: 25 }, (_, i) => step(`s${i}`)),
    );
    let state = many;
    for (let i = 0; i < 25; i += 1) {
      state = reduce(state, { type: 'remove', id: `s${i}` });
    }
    expect(state.removedStack.length).toBe(REMOVED_STACK_LIMIT);
    expect(state.removedStack.length).toBe(20);
    expect(state.removedStack[0].action.id).toBe('s5');
    expect(state.removedStack[19].action.id).toBe('s24');
  });

  it('undoRemove after a later edit still uses the saved index, not the end of the list', () => {
    const afterRemove = reduce(initial, { type: 'remove', id: 'b' });
    const afterInsert = reduce(afterRemove, { type: 'insertAt', index: 2, action: step('z') });
    const afterUndo = reduce(afterInsert, { type: 'undoRemove' });
    expect(afterUndo.actions.map((a) => a.id)).toEqual(['a', 'b', 'c', 'z']);
  });

  it('a new edit after undoRemove clears redo semantics so a second undoRemove is a no-op', () => {
    const afterRemove = reduce(initial, { type: 'remove', id: 'b' });
    const afterUndo = reduce(afterRemove, { type: 'undoRemove' });
    const afterPatch = reduce(afterUndo, { type: 'patchParams', id: 'a', patch: { note: 'x' } });
    const afterSecondUndo = reduce(afterPatch, { type: 'undoRemove' });
    expect(afterSecondUndo).toBe(afterPatch);
    expect(afterSecondUndo.actions.map((a) => a.id)).toEqual(['a', 'b', 'c']);
  });

  it('patchParams merges a single field without wiping the rest', () => {
    const next = reduce(initial, { type: 'patchParams', id: 'b', patch: { extra: 1 } });
    expect(next.actions[1].params).toEqual({ reason: 'busy', extra: 1 });
  });

  it('does not import entities or shared/api', () => {
    const src = readFileSync(join(specDir, 'editorReducer.ts'), 'utf8');
    expect(src).not.toMatch(/from ['"]@\/entities\//);
    expect(src).not.toMatch(/from ['"]@\/shared\/api/);
  });

  it('does not generate ids with Date.now or Math.random', () => {
    const reducerSrc = readFileSync(join(specDir, 'editorReducer.ts'), 'utf8');
    const clipboardSrc = readFileSync(join(specDir, 'clipboard.ts'), 'utf8');
    const combined = `${reducerSrc}\n${clipboardSrc}`;
    expect(combined).not.toMatch(/Date\.now\s*\(/);
    expect(combined).not.toMatch(/Math\.random\s*\(/);
  });
});

// Keep IRouteAction referenced so the spec stays aligned with the shared action shape.
void (null as unknown as IRouteAction);
