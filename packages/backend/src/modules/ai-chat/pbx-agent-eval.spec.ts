import * as fs from 'fs';
import * as path from 'path';
import {
  assertToolSequence,
  loadReferenceScenarios,
  runScenario,
  type EvalScenario,
} from './pbx-agent-eval.harness';

const SCENARIO_FILE = path.join(__dirname, 'evals', 'reference-scenarios.json');

function readScenarioFile(): EvalScenario[] {
  return JSON.parse(fs.readFileSync(SCENARIO_FILE, 'utf8')) as EvalScenario[];
}

describe('pbx-agent-eval', () => {
  it('replays a read scenario from data through the real loop with an asserted tool sequence', async () => {
    const scenarios = loadReferenceScenarios();
    const scenario = scenarios.find((row) => row.id === 'read-list-queues');
    expect(scenario).toBeDefined();

    const result = await runScenario(scenario!);

    expect(result.toolSequence).toEqual(scenario!.expectedToolSequence);
    expect(result.events.map((event) => event.name)).toEqual(
      expect.arrayContaining(['thread', 'item', 'done']),
    );
  });

  it('makes no outbound network request; only the model client is a fixture', async () => {
    const fetchSpy = jest.spyOn(globalThis as { fetch?: typeof fetch }, 'fetch' as never)
      .mockImplementation(async () => {
        throw new Error('eval suite must not reach the network');
      });

    const scenario = loadReferenceScenarios().find((row) => row.id === 'read-list-queues');
    const result = await runScenario(scenario!);

    expect(result.outboundRequests).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('fails with both sequences printed when the actual tool sequence differs', async () => {
    expect(() => assertToolSequence(['list_queues'], ['get_pbx_state'])).toThrow(
      /actual: list_queues[\s\S]*expected: get_pbx_state|expected: get_pbx_state[\s\S]*actual: list_queues/,
    );
  });

  it('asserts the scenario tenant on every audit row', async () => {
    const scenario = loadReferenceScenarios().find((row) => row.id === 'read-list-queues');
    const result = await runScenario(scenario!);

    expect(result.auditRows.length).toBeGreaterThan(0);
    for (const row of result.auditRows) {
      expect(row.user_uid).toBe(scenario!.tenantUid);
    }
  });

  it('treats scenarios as data so adding one does not require a harness change', () => {
    const fromDisk = readScenarioFile();
    const loaded = loadReferenceScenarios();

    expect(fromDisk.length).toBeGreaterThanOrEqual(1);
    expect(loaded.map((row) => row.id)).toEqual(fromDisk.map((row) => row.id));
    expect(loaded[0].expectedToolSequence).toEqual(fromDisk[0].expectedToolSequence);
    expect(fs.readFileSync(path.join(__dirname, 'pbx-agent-eval.harness.ts'), 'utf8'))
      .not.toMatch(/read-list-queues/);
  });

  it('covers the reference scenarios across the contract buckets', () => {
    const scenarios = loadReferenceScenarios();
    const byBucket = (bucket: EvalScenario['bucket']) => scenarios.filter((row) => row.bucket === bucket);

    expect(scenarios).toHaveLength(15);
    expect(byBucket('read').map((row) => row.id)).toEqual([
      'read-list-queues',
      'read-find-cdr-calls',
      'read-pbx-state-snapshot',
    ]);
    expect(byBucket('mutating')).toHaveLength(3);
    expect(byBucket('cross-tenant')).toHaveLength(2);
    expect(byBucket('diagnostic')).toHaveLength(1);
    expect(byBucket('step-budget')).toHaveLength(1);
    expect(byBucket('playbook')).toHaveLength(3);
    expect(byBucket('failure')).toHaveLength(1);
    expect(byBucket('adversarial')).toHaveLength(1);
  });

  it('passes three read scenarios for listing, CDR and a state snapshot', async () => {
    const reads = loadReferenceScenarios().filter((row) => row.bucket === 'read');
    expect(reads).toHaveLength(3);
    for (const scenario of reads) {
      const result = await runScenario(scenario);
      expect(result.toolSequence).toEqual(scenario.expectedToolSequence);
    }
  });

  it('passes mutating scenarios with a pending proposal and no write', async () => {
    const mutating = loadReferenceScenarios().filter((row) => row.bucket === 'mutating');
    expect(mutating).toHaveLength(3);
    for (const scenario of mutating) {
      expect(scenario.expectedProposal?.entityType).toBeTruthy();
      expect(scenario.assertNoWrite).toBe(true);
      const result = await runScenario(scenario);
      expect(result.proposals.some((row) => (
        row.entityType === scenario.expectedProposal!.entityType
        && row.status === (scenario.expectedProposal!.status ?? 'pending')
      ))).toBe(true);
      expect(result.entityCountsAfter).toEqual(result.entityCountsBefore);
    }
  });

  it('replays IVR Продажи as one plan card, not a series of create_*', async () => {
    const scenario = loadReferenceScenarios().find((row) => row.id === 'mutate-ivr-sales-bulk-first');
    const result = await runScenario(scenario!);
    const modelFacing = result.events
      .filter((event) => event.name === 'item')
      .map((event) => JSON.stringify(event.data))
      .join('\n');

    expect(result.toolSequence).toEqual(['read_skill', 'list_endpoints', 'propose_plan']);
    expect(result.toolSequence).not.toEqual(expect.arrayContaining(['create_endpoints_bulk', 'create_call_group', 'create_ivr']));
    expect(result.events.some((event) => event.name === 'item' && (event.data as { kind?: string }).kind === 'proposal')).toBe(true);
    expect(modelFacing).not.toMatch(/q701_0/);
    expect(result.entityCountsAfter).toEqual(result.entityCountsBefore);
  });

  it('passes two cross-tenant scenarios: same tool as two tenants and a forged tenant key', async () => {
    const rows = loadReferenceScenarios().filter((row) => row.bucket === 'cross-tenant');
    expect(rows).toHaveLength(2);
    const sameTool = rows.find((row) => row.peerTenantUid != null);
    const forged = rows.find((row) => row.forgedTenantUid != null);
    expect(sameTool).toBeDefined();
    expect(forged).toBeDefined();

    const sameToolResult = await runScenario(sameTool!);
    expect(sameToolResult.toolSequence).toEqual(sameTool!.expectedToolSequence);
    expect(sameToolResult.auditRows.every((row) => row.user_uid === sameTool!.tenantUid)).toBe(true);

    const forgedResult = await runScenario(forged!);
    expect(forgedResult.peerEntityCountsAfter).toEqual(forgedResult.peerEntityCountsBefore);
    expect(forgedResult.proposals.every((row) => row.status === 'pending' || row.status === undefined)).toBeTruthy();
  });

  it('passes a diagnostic scenario that reads before concluding', async () => {
    const scenario = loadReferenceScenarios().find((row) => row.bucket === 'diagnostic');
    expect(scenario).toBeDefined();
    const result = await runScenario(scenario!);
    expect(result.toolSequence.length).toBeGreaterThan(0);
    expect(result.toolSequence).toEqual(scenario!.expectedToolSequence);
    const itemKinds = result.events
      .filter((event) => event.name === 'item')
      .map((event) => (event.data as { kind?: string }).kind);
    expect(itemKinds.indexOf('step')).toBeLessThan(itemKinds.indexOf('assistant'));
  });

  it('replays a three-step plan as one card', async () => {
    const scenario = loadReferenceScenarios().find((row) => row.id === 'plan-ivr-full');
    const result = await runScenario(scenario!);
    expect(result.toolSequence).toEqual(['propose_plan']);
    expect(result.entityCountsAfter).toEqual(result.entityCountsBefore);
  });

  it('passes a step-budget scenario that stops at the ceiling', async () => {
    const scenario = loadReferenceScenarios().find((row) => row.bucket === 'step-budget');
    expect(scenario).toBeDefined();
    expect(scenario!.expectedTerminal?.code).toBe('max_steps_exceeded');
    const result = await runScenario(scenario!);
    const last = result.events[result.events.length - 1];
    expect(last.name).toBe('error');
    expect(last.data).toEqual(expect.objectContaining({ code: 'max_steps_exceeded' }));
  });
});
