import { BadRequestException } from '@nestjs/common';
import {
  collectHostActionErrors,
  throwIfInvalidActionPayload,
  validateActionParams,
} from './action-params-validation.util';

describe('validateActionParams (D-11)', () => {
  it('held-out: only the second action is reported, with its actionId', () => {
    const errors = validateActionParams([
      { id: 'first-ok', type: 'hangup', params: {} },
      { id: 'second-bad', type: 'toexten', params: { target: { source: 'fixed', value: '' } } },
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0].actionId).toBe('second-bad');
    expect(errors[0].path).toBe('target.value');
  });

  it('uses index:<n> when the action has no id', () => {
    const errors = validateActionParams([
      { type: 'toexten', params: { target: { source: 'fixed', value: '' } } },
    ]);
    expect(errors[0].actionId).toBe('index:0');
  });

  it('empty type is 400 and mentions the step id', () => {
    const errors = validateActionParams([{ id: 'step-3', type: '', params: {} }]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('step-3');
  });
});

describe('collectHostActionErrors', () => {
  it('held-out: route-level name error has actionId null and sits next to the step error', () => {
    const errors = collectHostActionErrors({
      name: '',
      actions: [
        { id: 'second-bad', type: 'toexten', params: { target: { source: 'fixed', value: '' } } },
      ],
    });
    expect(errors).toHaveLength(2);
    expect(errors.some((e) => e.actionId === null && e.path === 'name')).toBe(true);
    expect(errors.some((e) => e.actionId === 'second-bad' && e.path === 'target.value')).toBe(true);
  });
});

describe('throwIfInvalidActionPayload', () => {
  it('throws BadRequestException { errors } without leaking stack/sql', () => {
    try {
      throwIfInvalidActionPayload({
        actions: [{ id: 'a1', type: 'toexten', params: { target: { source: 'fixed', value: '' } } }],
      });
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      const body = (err as BadRequestException).getResponse() as { errors: Array<Record<string, unknown>> };
      expect(body.errors[0]).toEqual(
        expect.objectContaining({ actionId: 'a1', path: 'target.value' }),
      );
      expect(JSON.stringify(body)).not.toMatch(/stack|SELECT |FROM /i);
    }
  });
});
