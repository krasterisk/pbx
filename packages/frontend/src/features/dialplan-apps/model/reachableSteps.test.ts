import { describe, expect, it } from 'vitest';
import type { IRouteAction } from '@krasterisk/shared';
import { reachableStepIndices } from './reachableSteps';

const step = (type: IRouteAction['type'], params = {}, enabled = true): IRouteAction => ({
  id: crypto.randomUUID(), type, params, enabled, condition: {},
});
describe('local branch reachability', () => {
  it('keeps the linear hangup warning and ignores a disabled hangup', () => {
    expect([...reachableStepIndices([step('hangup'), step('text2speech')])]).toEqual([0]);
    expect(reachableStepIndices([step('hangup', {}, false), step('text2speech')])).toEqual(new Set([0, 1]));
  });
  it('reaches both named branches around a hangup', () => {
    const actions = [step('goto', { label_name: 'yes', false_label: 'no', condition: { source: 'variable' } }),
      step('label', { label_name: 'no' }), step('hangup'), step('label', { label_name: 'yes' }), step('text2speech'), step('hangup')];
    expect(reachableStepIndices(actions)).toEqual(new Set([0, 1, 2, 3, 4, 5]));
  });
  it('allows fallthrough when a terminal action has a step-level condition', () => {
    const guarded = { ...step('hangup'), condition: { dialstatus: 'BUSY' as const } };
    expect(reachableStepIndices([guarded, step('text2speech')])).toEqual(new Set([0, 1]));
  });
  it('follows a conditional fallthrough and an unconditional branch', () => {
    const actions = [step('goto', { label_name: 'end', condition: { dialstatus: 'BUSY' } }),
      step('text2speech'), step('goto', { label_name: 'end' }), step('text2speech'),
      step('label', { label_name: 'end' }), step('hangup')];
    expect(reachableStepIndices(actions)).toEqual(new Set([0, 1, 2, 4, 5]));
  });
  it('bounds loops and supports backward labels', () => {
    expect(reachableStepIndices([step('label', { label_name: 'retry' }), step('goto', { label_name: 'retry' }), step('hangup')]))
      .toEqual(new Set([0, 1]));
  });
  it.each([
    [step('goto', { label_name: 'missing' }), step('hangup'), step('text2speech')],
    [step('goto', { label_name: '${DYNAMIC}' }), step('hangup'), step('text2speech')],
    [step('label', { label_name: 'same' }), step('label', { label_name: 'same' }), step('hangup'), step('text2speech')],
    [step('cmd'), step('hangup'), step('text2speech')],
  ])('does not assert unreachable when control flow is unknown', (...actions) => {
    expect(reachableStepIndices(actions)).toEqual(new Set(actions.map((_, index) => index)));
  });
});
