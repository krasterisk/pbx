import { hasAutodialCdrBillsec, mergeAutodialAttemptEvidence } from './autodial-attempt-evidence.util';

describe('durable attempt evidence', () => {
  it('distinguishes a new snapshot from authoritative dialplan facts, including zero seconds', () => {
    const evidence = { _evidence_version: 1, snapshot: { revision: 7 } };
    expect(hasAutodialCdrBillsec(evidence)).toBe(false);
    expect(hasAutodialCdrBillsec(mergeAutodialAttemptEvidence(evidence, { duration: 0 }, true))).toBe(true);
    expect(hasAutodialCdrBillsec({ dtmf: '1', duration: 12 })).toBe(true);
    expect(hasAutodialCdrBillsec(null)).toBe(false);
  });
  it('preserves the frozen snapshot and source after a later callback or process restart', () => {
    const stored = { _evidence_version: 1, snapshot: { revision: 2, variables: [{ name: 'AC_NAME', value: 'Original' }] } };
    const first = mergeAutodialAttemptEvidence(stored, { business_outcome: 'confirmed' }, true);
    const restored = JSON.parse(JSON.stringify(first));
    const next = mergeAutodialAttemptEvidence(restored, { snapshot: { revision: 999 }, _facts: {}, dtmf: '1' });
    expect(next).toMatchObject({ snapshot: stored.snapshot, _facts: { billsec_source: 'dialplan' }, business_outcome: 'confirmed', dtmf: '1' });
  });
  it('retains the admitted connection meaning and actual bridge fact after the later hangup callback', () => {
    const stored = { _evidence_version: 1, snapshot: { revision: 2, steps: [{ type: 'toqueue', connectionOutcome: {
      code: 'operator_connected', label: 'Original support label', category: 'positive', goal_relation: 'achieved',
    } }] }, business_outcome: 'operator_connected', operator_connection: { interface: 'PJSIP/e00991420_0', source: 'ami_agent_connect' } };
    expect(mergeAutodialAttemptEvidence(stored, { dtmf: null, duration: 15 }, true)).toMatchObject({
      business_outcome_label: 'Original support label', business_goal_relation: 'achieved', operator_connection: stored.operator_connection,
      snapshot: stored.snapshot, _facts: { billsec_source: 'dialplan' },
    });
  });
});
