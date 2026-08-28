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

  it('rejects reserved and duplicate directory lookup output names', () => {
    const errors = clientStepFieldErrors({
      id: '1',
      type: 'directory_lookup',
      params: {
        directoryUid: 7,
        keySource: { source: 'original_caller' },
        onMissing: 'keep',
        outputs: [
          { fieldUid: 17, targetVariable: 'KRSK_NAME' },
          { fieldUid: 18, targetVariable: 'customer' },
          { fieldUid: 19, targetVariable: 'CALLERID' },
          { fieldUid: 20, targetVariable: 'OK_VAR' },
          { fieldUid: 21, targetVariable: 'OK_VAR' },
        ],
      },
      condition: {},
    });
    expect(errors.outputs).toBe('invalid');
  });
});
