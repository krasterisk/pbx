import { autodialConversationSnapshot, autodialTestSnapshot } from './autodial-test-snapshot.util';

describe('internal test admission evidence', () => {
  it('freezes only referenced values and safe metadata without claiming execution', () => {
    const params = { text: 'Hello {AC_NAME}', engine: 3, api_key: 'never-store-this' };
    const result = autodialTestSnapshot(4, [
      { id: 'speech', type: 'text2speech', params },
      { id: 'read', type: 'collect_input', params: { outcomeMap: { '1': 'confirmed' } } },
      { id: 'queue', type: 'toqueue', params: { queue: 'private' } },
    ], { __AC_NAME: 'Synthetic Anna', __AC_UNUSED: 'excluded' });
    expect(result.variables).toEqual([{ name: 'AC_NAME', value: 'Synthetic Anna' }]);
    expect(result.steps[0]).toMatchObject({ status: 'not_observed', text: 'Hello Synthetic Anna' });
    expect(result.skipped_steps).toEqual(['toqueue']);
    expect(JSON.stringify(result)).not.toContain('never-store-this');
    expect(JSON.stringify(result)).not.toContain('excluded');
    params.text = 'Changed';
    expect(result.steps[0].text).toBe('Hello Synthetic Anna');
  });
  it('freezes the resolved queue and explicit connection meaning; internal tests still skip it', () => {
    const meaning = { code: 'operator_connected', label: 'Original label', category: 'positive', goal_relation: 'achieved' };
    const actions = [{ id: 'queue', type: 'toqueue', params: { target: { source: 'fixed', value: '700' }, connectionOutcome: meaning } }];
    const normal = autodialConversationSnapshot(3, actions, {}, false, 'operator', 7);
    const internal = autodialTestSnapshot(3, actions, {}, 'operator', 7);
    meaning.label = 'Changed later';
    expect(normal.steps[0]).toMatchObject({ queue_name: 'q700_7', status: 'not_observed', connectionOutcome: { label: 'Original label' } });
    expect(internal.steps[0]).toMatchObject({ queue_name: 'q700_7', status: 'skipped' });
  });
});
