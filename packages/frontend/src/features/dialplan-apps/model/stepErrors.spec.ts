import { describe, it, expect } from 'vitest';
import { mapStepErrors } from './stepErrors';

const actions = [
  { id: 'a' },
  { id: 'b' },
];

describe('mapStepErrors', () => {
  it('highlights only the matching step and field (backstop)', () => {
    const mapped = mapStepErrors(
      {
        errors: [{ actionId: 'b', path: 'params.target', message: 'required' }],
      },
      actions,
    );
    expect(mapped.byStep.has('a')).toBe(false);
    expect(mapped.byStep.get('b')).toEqual({ target: 'required' });
    expect(mapped.orphans).toEqual([]);
  });

  it('sends unknown actionId to orphans and keeps every error visible', () => {
    const mapped = mapStepErrors(
      {
        errors: [
          { actionId: 'b', path: 'params.target', message: 'required' },
          { actionId: 'zzz', path: 'params.x', message: 'gone' },
        ],
      },
      actions,
    );
    expect(mapped.byStep.get('b')).toEqual({ target: 'required' });
    expect(mapped.orphans).toEqual([{ actionId: 'zzz', path: 'params.x', message: 'gone' }]);
    expect(mapped.byStep.size + mapped.orphans.length).toBe(2);
  });
});
