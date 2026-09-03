import { DialplanDryRunAiAdapter } from './dialplan-dry-run-ai.adapter';

describe('DialplanDryRunAiAdapter (D-32)', () => {
  let dryRunService: { run: jest.Mock };
  let registry: { register: jest.Mock };
  let adapter: DialplanDryRunAiAdapter;

  const getTool = () => adapter.getTools().find((tool) => tool.name === 'dialplan_dry_run')!;

  beforeEach(() => {
    dryRunService = { run: jest.fn().mockResolvedValue({ hopsUsed: 0, outcome: { kind: 'terminal' } }) };
    registry = { register: jest.fn() };
    adapter = new DialplanDryRunAiAdapter(dryRunService as never, registry as never);
  });

  it('exposes dialplan_dry_run and registers on init', () => {
    expect(adapter.getTools().map((tool) => tool.name)).toEqual(['dialplan_dry_run']);
    expect(getTool().destructive).toBeFalsy();
    expect(getTool().entityType).toBe('dialplan_dry_run');
    adapter.onModuleInit();
    expect(registry.register).toHaveBeenCalledWith(adapter);
  });

  it('passes call-time vpbxUserUid, never a body field (T-14-07)', async () => {
    const body = {
      host: 'route',
      actions: [{ id: 'a', type: 'hangup', params: {}, condition: {} }],
      vpbxUserUid: 999,
    };
    await getTool().handler(body, 111);
    await getTool().handler(body, 222);
    expect(dryRunService.run).toHaveBeenNthCalledWith(1, 111, expect.objectContaining({ host: 'route' }));
    expect(dryRunService.run).toHaveBeenNthCalledWith(2, 222, expect.objectContaining({ host: 'route' }));
    expect(dryRunService.run.mock.calls[0][0]).not.toBe(999);
  });
});
