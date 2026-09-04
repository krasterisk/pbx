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
      expect.arrayContaining(['progress', 'tool_call', 'tool_result', 'text', 'done']),
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
});
