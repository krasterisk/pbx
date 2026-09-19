import { emptyMetricStores, evalApplicability, overallScore, publishMetric, scoreMetric } from './metric-engine';

describe('MET1 metric publish', () => {
  it('rejects unsafe expressions and duplicate type changes', () => {
    const stores = emptyMetricStores();
    expect(() => publishMetric({
      stores, projectId: 'p1', operationKey: 'a',
      rubric: {
        key: 'Greeting!', displayName: 'x', type: 'boolean', instructions: 'ok',
        polarity: 'positive', weight: 1, required: true,
      },
    })).toThrow(/metric_key_invalid/);
    expect(() => publishMetric({
      stores, projectId: 'p1', operationKey: 'b',
      rubric: {
        key: 'inject', displayName: 'x', type: 'boolean',
        instructions: 'SELECT password FROM users', polarity: 'positive', weight: 1, required: true,
      },
    })).toThrow(/unsafe_expression/);
    const first = publishMetric({
      stores, projectId: 'p1', operationKey: 'c',
      rubric: {
        key: 'greeting_present', displayName: 'Приветствие', type: 'boolean',
        instructions: 'есть ли приветствие', polarity: 'positive', weight: 1, required: true,
      },
    });
    expect(publishMetric({
      stores, projectId: 'p1', operationKey: 'c',
      rubric: {
        key: 'greeting_present', displayName: 'Приветствие', type: 'boolean',
        instructions: 'есть ли приветствие', polarity: 'positive', weight: 1, required: true,
      },
    }).revisionId).toBe(first.revisionId);
    expect(() => publishMetric({
      stores, projectId: 'p1', operationKey: 'd',
      rubric: {
        key: 'greeting_present', displayName: 'Приветствие', type: 'number',
        instructions: 'score', polarity: 'positive', weight: 1, required: true, min: 0, max: 1,
      },
    })).toThrow(/type_mismatch/);
  });
});

describe('MET2 scoring', () => {
  it('does not treat silence as a fail and keeps unknown in coverage', () => {
    const rubric = {
      key: 'greeting_present', displayName: 'g', type: 'boolean' as const,
      instructions: 'x', polarity: 'positive' as const, weight: 1, required: true,
    };
    expect(scoreMetric(rubric, { speech: false, applicable: true, value: false }).status).toBe('unscorable');
    expect(scoreMetric(rubric, { speech: true, applicable: true, value: false, roleKnown: true })).toMatchObject({
      status: 'scored', boolValue: false, normalised: 0,
    });
    expect(evalApplicability({ op: 'eq', field: 'direction', value: 'in' }, {})).toBeNull();
    const overall = overallScore([
      { weight: 1, status: 'scored', normalised: 100 },
      { weight: 1, status: 'unknown', normalised: null },
    ]);
    expect(overall.overall).toBeNull();
    expect(overall.coverage).toBe(0.5);
  });
});
