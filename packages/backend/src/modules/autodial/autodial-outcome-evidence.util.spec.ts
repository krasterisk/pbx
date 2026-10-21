import { frozenAutodialOutcome, stampAutodialOutcome } from './autodial-outcome-evidence.util';

describe('frozen business outcome meaning', () => {
  const definition = { label: 'Appointment confirmed', category: 'positive', goal_relation: 'achieved' };
  it('uses the admitted label and leaves unmapped legacy codes unknown', () => {
    const snapshot = { steps: [{ outcomeDefinitions: { confirmed: { ...definition } } }] };
    const result: Record<string, unknown> = { business_outcome: 'confirmed' };
    stampAutodialOutcome(result, snapshot);
    expect(result).toMatchObject({ business_outcome_label: 'Appointment confirmed', business_goal_relation: 'achieved' });
    result.business_outcome = 'legacy'; stampAutodialOutcome(result, snapshot);
    expect(result).toMatchObject({ business_outcome_label: null, business_goal_relation: 'unknown' });
  });
  it('does not choose arbitrarily between contradictory meanings of the same code', () => {
    expect(frozenAutodialOutcome({ steps: [
      { outcomeDefinitions: { confirmed: definition } },
      { outcomeDefinitions: { confirmed: { ...definition, label: 'A different goal' } } },
    ] }, 'confirmed')).toBeNull();
  });
  it('recognizes an explicitly configured playback-completion outcome', () => {
    expect(frozenAutodialOutcome({ steps: [{ completionOutcome: { code: 'message_played', ...definition } }] }, 'message_played')).toEqual(definition);
  });
});
