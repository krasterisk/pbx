import { describe, it, expect } from 'vitest';
import { clientStepFieldErrors, resolveClientFieldError } from './clientStepFieldErrors';
import { SAFE_LABEL_NAME } from './schemas/label';

const t = (_key: string, fallback?: string) => fallback ?? _key;

describe('clientStepFieldErrors', () => {
  it('rejects invalid label names', () => {
    const errors = clientStepFieldErrors({
      id: '1',
      type: 'label',
      params: { label_name: 'bad(label)' },
      condition: {},
    });
    expect(errors.label_name).toBe('invalid');
    expect(resolveClientFieldError(errors.label_name, t)).toMatch(/Недопустимые/);
  });

  it('accepts safe label names', () => {
    expect(SAFE_LABEL_NAME.test('retry_1')).toBe(true);
    const errors = clientStepFieldErrors({
      id: '1',
      type: 'label',
      params: { label_name: 'retry_1' },
      condition: {},
    });
    expect(errors).toEqual({});
  });
});
