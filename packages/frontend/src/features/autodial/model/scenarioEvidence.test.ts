import { describe, expect, it } from 'vitest';
import { attemptAdmissionValues, observedScenarioSteps } from './scenarioEvidence';

describe('historical admission values', () => {
  it('does not present current or legacy data as a saved call snapshot', () => {
    expect(attemptAdmissionValues({ business_outcome: 'confirmed' })).toBeNull();
    expect(attemptAdmissionValues({ snapshot: { revision: 2, variables: [] } })).toBeNull();
  });
  it('accepts frozen values and ignores malformed entries without reformatting historical speech', () => {
    expect(attemptAdmissionValues({ _evidence_version: 1, snapshot: { version: 1, revision: 2,
      variables: [{ name: 'AC_DATE_SAY_DATE', value: 'twentieth October' }, null, { name: 'x', value: {} }] } }))
      .toEqual({ revision: 2, variables: [{ name: 'AC_DATE_SAY_DATE', value: 'twentieth October' }] });
  });
  it('uses observed results while keeping skipped and unobserved steps distinct', () => {
    const steps = observedScenarioSteps({ steps: [
      { id: 'speech', type: 'text2speech', status: 'not_observed' },
      { id: 'queue', type: 'toqueue', status: 'skipped' },
      { id: 'later', type: 'collect_input', status: 'not_observed' },
    ] }, { steps: { speech: { status: 'completed', detail: 'SUCCESS' }, queue: { status: 'completed' } } });
    expect(steps.map((step) => step.status)).toEqual(['completed', 'skipped', 'not_observed']);
    expect(observedScenarioSteps(null, {})).toEqual([]);
  });
});
