import { directoryBindingsToSteps, directoryStepErrors } from './directoryStep';
import type { IRouteDirectoryBinding } from './types/directory.types';
const base = {
  directoryUid: 7,
  keySource: { source: 'current_caller' },
  outputs: [],
  onMissing: 'keep',
  matchMode: 'on_match',
  behavior: 'drop',
};
describe('Directory step contracts', () => {
  it('converts ordered bindings without mutating nested settings and avoids duplicate IDs', () => {
    const bindings: IRouteDirectoryBinding[] = [
      {
        uid: 1,
        directory_uid: 7,
        position: 2,
        key_source: { source: 'fixed', value: '200' },
        match_mode: 'on_no_match',
        behavior_type: 'redirect',
        behavior_params: { fixedExten: '300' },
      },
      {
        uid: 2,
        directory_uid: 8,
        position: 1,
        key_source: { source: 'original_caller' },
        match_mode: 'on_match',
        behavior_type: 'custom',
        actions: [{ id: 'h', type: 'hangup', params: {}, condition: {} }],
      },
    ];
    const steps = directoryBindingsToSteps(bindings, [
      { id: 'directory_2', type: 'hangup', params: {}, condition: {} },
    ]);
    expect(steps.map((s) => s.id)).toEqual(['directory_2_1', 'directory_1']);
    expect(steps[0].params.actions[0].id).toBe('h');
    steps[1].params.behaviorParams.fixedExten = '900';
    expect(bindings[0].behavior_params?.fixedExten).toBe('300');
    expect(directoryBindingsToSteps([])).toEqual([]);
  });
  it.each([
    'original_caller',
    'current_caller',
    'route_pattern',
    'fixed',
    'variable',
  ])('validates %s key', (source) => {
    expect(
      directoryStepErrors({
        ...base,
        keySource: { source, value: '200', name: 'my_key' },
      }),
    ).toEqual({});
  });
  it.each([
    'set_name',
    'set_number',
    'redirect',
    'map_fields',
    'custom',
    'drop',
  ])('validates %s behavior', (behavior) => {
    expect(
      directoryStepErrors({
        ...base,
        behavior,
        behaviorParams: {
          fieldUid: 18,
          mappings: [{ fieldUid: 18, targetVariable: 'CLIENT_NAME' }],
        },
        actions: [],
      }),
    ).toEqual({});
  });
  it('rejects unsafe variables, foreign shape, missing fields and nested policies', () => {
    expect(
      directoryStepErrors({ ...base, directoryUid: true }).directoryUid,
    ).toBe('required');
    expect(
      directoryStepErrors({
        ...base,
        behavior: 'map_fields',
        behaviorParams: {
          mappings: [{ fieldUid: 1, targetVariable: 'KRSK_STATUS' }],
        },
      }).behavior,
    ).toBeDefined();
    expect(
      directoryStepErrors({
        ...base,
        behavior: 'set_number',
        behaviorParams: { fixed: '200);Hangup()' },
      }).behavior,
    ).toBeDefined();
    expect(
      directoryStepErrors({
        ...base,
        behavior: 'custom',
        actions: [{ type: 'directory_lookup', params: base }],
      }).behavior,
    ).toBeDefined();
    expect(
      directoryStepErrors({
        ...base,
        behavior: 'set_name',
        behaviorParams: { fixed: 'Иван, \"VIP\"' },
      }),
    ).toEqual({});
  });
});
