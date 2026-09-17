import {
  computeOverDialFactor,
  defaultAutodialPredictive,
  isAbandonedOutcome,
  observedAbandonPct,
  PREDICTIVE_WINDOW,
  pushObservation,
} from './autodial-predictive.util';

describe('isAbandonedOutcome', () => {
  it('is not abandoned when the subscriber never answered', () => {
    expect(
      isAbandonedOutcome({ answered: false, agentInterface: null, disposition: 'no_answer' }),
    ).toBe(false);
  });

  it('is not abandoned when an agent took the leg', () => {
    expect(
      isAbandonedOutcome({
        answered: true,
        agentInterface: 'PJSIP/e101',
        disposition: 'success',
      }),
    ).toBe(false);
  });

  it('is abandoned when nobody picked the answered call up', () => {
    expect(
      isAbandonedOutcome({ answered: true, agentInterface: null, disposition: 'answered_short' }),
    ).toBe(true);
  });

  it('does not blame machine detections on the pacer', () => {
    expect(
      isAbandonedOutcome({ answered: true, agentInterface: null, disposition: 'amd_machine' }),
    ).toBe(false);
    expect(
      isAbandonedOutcome({ answered: true, agentInterface: null, disposition: 'voicemail' }),
    ).toBe(false);
  });
});

describe('observedAbandonPct', () => {
  it('reports zero on an empty window instead of dividing by zero', () => {
    expect(observedAbandonPct({ answered: 0, abandoned: 0 })).toBe(0);
  });

  it('reports the share of answered calls that were dropped', () => {
    expect(observedAbandonPct({ answered: 50, abandoned: 5 })).toBe(10);
  });
});

describe('pushObservation', () => {
  it('counts answered calls and abandons separately', () => {
    const obs = pushObservation(pushObservation({ answered: 0, abandoned: 0 }, true), false);
    expect(obs).toEqual({ answered: 2, abandoned: 1 });
  });

  it('halves both counters once the window overflows so recent calls dominate', () => {
    const obs = pushObservation({ answered: PREDICTIVE_WINDOW, abandoned: 10 }, false);
    expect(obs.answered).toBe(Math.round((PREDICTIVE_WINDOW + 1) / 2));
    expect(obs.abandoned).toBe(5);
  });
});

describe('computeOverDialFactor', () => {
  const config = defaultAutodialPredictive();

  it('ramps in small steps while the sample is too small to judge', () => {
    const factor = computeOverDialFactor({
      config,
      observation: { answered: 3, abandoned: 0 },
      previous: 1,
    });
    expect(factor).toBeGreaterThan(1);
    expect(factor).toBeLessThanOrEqual(1.2);
  });

  it('never exceeds the cautious ceiling before min_samples is reached', () => {
    const factor = computeOverDialFactor({
      config: { ...config, max_over_dial: 3 },
      observation: { answered: 1, abandoned: 0 },
      previous: 1.9,
    });
    expect(factor).toBe(1.2);
  });

  it('climbs while abandon rate stays under target', () => {
    const factor = computeOverDialFactor({
      config,
      observation: { answered: 100, abandoned: 1 },
      previous: 1.4,
    });
    expect(factor).toBeGreaterThan(1.4);
  });

  it('backs off proportionally to the overrun', () => {
    const factor = computeOverDialFactor({
      config,
      observation: { answered: 100, abandoned: 13 },
      previous: 1.5,
    });
    // 13% observed against a 3% target: 10 points of overrun at 0.05 gain
    expect(factor).toBe(1);
  });

  it('backs off gently on a small overrun', () => {
    const factor = computeOverDialFactor({
      config,
      observation: { answered: 100, abandoned: 5 },
      previous: 1.8,
    });
    expect(factor).toBe(1.7);
  });

  it('is clamped to the configured ceiling', () => {
    const factor = computeOverDialFactor({
      config: { ...config, max_over_dial: 1.5 },
      observation: { answered: 100, abandoned: 0 },
      previous: 1.5,
    });
    expect(factor).toBe(1.5);
  });

  it('never drops below one — predictive is still at least progressive', () => {
    const factor = computeOverDialFactor({
      config,
      observation: { answered: 100, abandoned: 90 },
      previous: 1.1,
    });
    expect(factor).toBe(1);
  });
});
