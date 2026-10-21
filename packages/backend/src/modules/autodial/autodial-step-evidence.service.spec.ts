import { AutodialStepEvidenceService } from './autodial-step-evidence.service';

describe('PBX step evidence', () => {
  function fixture() {
    let result: Record<string, unknown> = {};
    const snapshot = { steps: [
      { id: 'speech', type: 'text2speech', status: 'not_observed' },
      { id: 'input', type: 'collect_input', status: 'not_observed', outcomes: { '1': 'confirmed' }, outcomeDefinitions: {
        confirmed: { label: 'Appointment confirmed', category: 'positive', goal_relation: 'achieved' },
      } },
      { id: 'queue', type: 'toqueue', status: 'skipped' },
    ] };
    const query = jest.fn(async (sql, options) => {
      if (sql.startsWith('SELECT')) return options.replacements.tenant === 7 ? [{ evidence: structuredClone(result), snapshot }] : [];
      result = JSON.parse(options.replacements.result); return [undefined, 1];
    });
    const service = new AutodialStepEvidenceService({} as never, { query, transaction: async (_options, callback) => callback({}) } as never);
    const event = { tenant: '7', test: '11111111-1111-1111-1111-111111111111', step: 'speech', type: 'text2speech', userevent: 'AutodialStepResult', status: 'SUCCESS' };
    return { service, event, query, result: () => result };
  }
  it('records entry separately from successful playback and retains a later failure', async () => {
    const f = fixture();
    await f.service.record({ ...f.event, userevent: 'AutodialStep' });
    expect(f.result()).not.toHaveProperty('delivery');
    await f.service.record(f.event);
    expect(f.result()).toMatchObject({ delivery: 'playback_completed', steps: { speech: { status: 'completed' } } });
    await f.service.record({ ...f.event, status: 'TTS_FAILED' });
    await f.service.record(f.event);
    expect(f.result().delivery).toBe('playback_failed');
  });
  it('distinguishes no input, invalid input and an admitted outcome without inventing confirmation', async () => {
    const f = fixture(), event = { ...f.event, step: 'input', type: 'collect_input' };
    await f.service.record({ ...event, status: 'TIMEOUT' });
    expect(f.result()).toMatchObject({ steps: { input: { status: 'no_input' } } });
    expect(f.result()).not.toHaveProperty('business_outcome');
    await f.service.record({ ...event, status: 'OK', digits: '9' });
    expect(f.result()).toMatchObject({ steps: { input: { status: 'invalid_input' } } });
    expect(f.result()).not.toHaveProperty('business_outcome');
    await f.service.record({ ...event, status: 'OK', digits: '1' });
    expect(f.result()).toMatchObject({ business_outcome: 'confirmed', business_outcome_label: 'Appointment confirmed', business_goal_relation: 'achieved', dtmf: '1', steps: { input: { status: 'completed' } } });
  });
  it('does not upgrade skipped, foreign or unknown steps into observed execution', async () => {
    const f = fixture();
    await f.service.record({ ...f.event, step: 'queue', type: 'toqueue' });
    await f.service.record({ ...f.event, step: 'unknown' });
    await f.service.record({ ...f.event, tenant: '8' });
    expect(f.query.mock.calls.filter(([sql]) => sql.startsWith('UPDATE'))).toHaveLength(0);
  });
});

describe('ordinary queue connection evidence', () => {
  // Shape captured from the real Asterisk20 LAN queue handoff (source7).
  const connect = { event: 'AgentConnect', uniqueid: 'ac-8-5-1', linkedid: 'ac-8-5-1',
    queue: 'q00991426_0', interface: 'PJSIP/e00991420_0', destuniqueid: '1792334070.62' };
  function fixture(meaning = true) {
    let evidence: Record<string, unknown> = { _evidence_version: 1, snapshot: { revision: 3, business_goal: 'operator', steps: [
      { id: 'queue', type: 'toqueue', status: 'not_observed', queue_name: 'q00991426_0', ...(meaning ? {
        connectionOutcome: { code: 'operator_connected', label: 'Original connection label', category: 'positive', goal_relation: 'achieved' },
      } : {}) },
    ] } };
    const query = jest.fn(async (sql, options) => {
      if (sql.startsWith('SELECT')) return options.replacements.channel === 'ac-8-5-1'
        || options.replacements.tenant === 0 && options.replacements.uid === 5 ? [{ uid: 5, tenant: 0, evidence: structuredClone(evidence) }] : [];
      evidence = JSON.parse(options.replacements.result); return [undefined, 1];
    });
    const service = new AutodialStepEvidenceService({} as never, { query, transaction: async (_options, callback) => callback({}) } as never);
    return { service, query, evidence: () => evidence };
  }
  it('uses an actual bridge event and frozen meaning, independently of technical call duration', async () => {
    const f = fixture();
    await f.service.recordAgentConnection({ ...connect, tenant: '999' });
    expect(f.evidence()).toMatchObject({ business_outcome: 'operator_connected', business_outcome_label: 'Original connection label',
      business_goal_relation: 'achieved', operator_connection: { queue: connect.queue, interface: connect.interface, source: 'ami_agent_connect' },
      steps: { queue: { status: 'completed', detail: 'AGENT_CONNECTED' } } });
    expect(f.query.mock.calls[0][1].replacements).toEqual({ channel: 'ac-8-5-1', campaign: 8, task: 5, attemptNo: 1 });
    expect(f.query.mock.calls[1][1].replacements).toMatchObject({ uid: 5, tenant: 0 });
    await f.service.recordAgentConnection(connect);
    expect(f.query.mock.calls.filter(([sql]) => sql.startsWith('UPDATE'))).toHaveLength(1);
    await f.service.record({ tenant: '0', attempt: '5', type: 'toqueue', step: 'queue', userevent: 'AutodialStep' });
    expect(f.evidence()).toMatchObject({ steps: { queue: { status: 'completed', detail: 'AGENT_CONNECTED' } }, business_goal_relation: 'achieved' });
  });
  it('refuses queue entry, ringing, a different admitted queue and unknown channels', async () => {
    const f = fixture();
    await f.service.recordAgentConnection({ ...connect, event: 'AgentCalled' });
    await f.service.recordAgentConnection({ ...connect, event: 'QueueCallerJoin' });
    await f.service.recordAgentConnection({ ...connect, queue: 'q_other_0' });
    await f.service.recordAgentConnection({ ...connect, uniqueid: 'ac-9-5-1' });
    await f.service.recordAgentConnection({ ...connect, uniqueid: 'external-channel' });
    expect(f.query.mock.calls.filter(([sql]) => sql.startsWith('UPDATE'))).toHaveLength(0);
  });
  it('retains the connection fact without inventing a business outcome for legacy metadata', async () => {
    const f = fixture(false);
    await f.service.recordAgentConnection(connect);
    expect(f.evidence()).toHaveProperty('operator_connection');
    expect(f.evidence()).not.toHaveProperty('business_outcome');
  });
});
