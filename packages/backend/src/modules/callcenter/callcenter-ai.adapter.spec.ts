import { CallCenterAiAdapter } from './callcenter-ai.adapter';

/**
 * Unit tests for CallCenterAiAdapter (D-41b, D-42) — Domain AI Adapter for CC.
 * Plain instantiation (no Nest TestingModule), matching phonebooks-ai.adapter.spec.ts.
 */
describe('CallCenterAiAdapter', () => {
  let ccService: any;
  let stateService: any;
  let registry: any;
  let adapter: CallCenterAiAdapter;

  const getTool = (name: string) => adapter.getTools().find((t) => t.name === name)!;

  beforeEach(() => {
    ccService = {
      supervisorForcePause: jest.fn().mockResolvedValue({ success: true }),
      supervisorForceUnpause: jest.fn().mockResolvedValue({ success: true }),
    };
    stateService = {
      getAllQueues: jest.fn().mockReturnValue([]),
      getAllAgents: jest.fn().mockReturnValue([]),
      getSnapshot: jest.fn().mockReturnValue({ agents: [], queues: [], calls: [] }),
    };
    registry = { register: jest.fn() };

    adapter = new CallCenterAiAdapter(ccService, stateService, registry);
  });

  describe('getTools', () => {
    it('returns unique snake_case tools; force-pause/unpause are destructive', () => {
      const tools = adapter.getTools();
      const names = tools.map((t) => t.name);
      expect(names).toEqual([
        'cc_get_queue_snapshot',
        'cc_get_agents',
        'cc_get_today_kpi',
        'cc_force_pause_agent',
        'cc_force_unpause_agent',
      ]);
      expect(new Set(names).size).toBe(names.length);

      expect(getTool('cc_get_queue_snapshot').destructive).toBeFalsy();
      expect(getTool('cc_get_agents').destructive).toBeFalsy();
      expect(getTool('cc_get_today_kpi').destructive).toBeFalsy();
      expect(getTool('cc_force_pause_agent').destructive).toBe(true);
      expect(getTool('cc_force_unpause_agent').destructive).toBe(true);
      expect(getTool('cc_force_pause_agent').entityType).toBe('callcenter_agent');
    });
  });

  describe('onModuleInit', () => {
    it('registers itself with AiAdapterRegistryService', () => {
      adapter.onModuleInit();
      expect(registry.register).toHaveBeenCalledWith(adapter);
    });
  });

  describe('tenant isolation via vpbxUserUid parameter (D-42)', () => {
    it('cc_get_queue_snapshot uses uid from call parameter, not closure', async () => {
      stateService.getAllQueues.mockImplementation((uid: number) => [
        {
          name: `q${uid}`,
          displayName: `Queue ${uid}`,
          waiting: 1,
          talking: 0,
          agents: { total: 1, available: 1, paused: 0, busy: 0 },
          sla: 90,
          calls: { answered: 5, abandoned: 1, total: 6 },
          avgWait: 3,
          avgTalk: 40,
          userUid: uid,
        },
      ]);

      await getTool('cc_get_queue_snapshot').handler({}, 42);
      expect(stateService.getAllQueues).toHaveBeenCalledWith(42);

      await getTool('cc_get_queue_snapshot').handler({}, 99);
      expect(stateService.getAllQueues).toHaveBeenCalledWith(99);
    });

    it('cc_force_pause_agent passes vpbxUserUid from parameter; different uid → different tenant', async () => {
      await getTool('cc_force_pause_agent').handler(
        { agent_interface: 'PJSIP/e101_1', reason: 'break', confirm: true },
        42,
      );
      expect(ccService.supervisorForcePause).toHaveBeenCalledWith('PJSIP/e101_1', 'break', 42);

      await getTool('cc_force_pause_agent').handler(
        { agent_interface: 'PJSIP/e101_1', reason: 'break', confirm: true },
        77,
      );
      expect(ccService.supervisorForcePause).toHaveBeenCalledWith('PJSIP/e101_1', 'break', 77);
    });
  });

  describe('buildSummary', () => {
    it('returns compact KPI text, not full call dump', async () => {
      stateService.getAllQueues.mockReturnValue([
        {
          name: 'sales',
          waiting: 2,
          talking: 1,
          agents: { total: 3, available: 1, paused: 1, busy: 1 },
          sla: 95,
          calls: { answered: 10, abandoned: 2, total: 12 },
          userUid: 1,
        },
      ]);
      stateService.getAllAgents.mockReturnValue([
        { interface: 'PJSIP/1', status: 'PAUSED', pauseReason: 'lunch', userUid: 1 },
        { interface: 'PJSIP/2', status: 'READY', userUid: 1 },
      ]);
      stateService.getSnapshot.mockReturnValue({
        agents: [{}, {}],
        queues: [{}],
        calls: [{ uniqueid: 'should-not-appear' }, { uniqueid: 'nor-this' }],
      });

      const summary = await adapter.getStateProvider()!.buildSummary(1);
      expect(summary).toContain('очередей');
      expect(summary).toContain('sales');
      expect(summary).toMatch(/пауз/i);
      expect(summary).not.toContain('should-not-appear');
      expect(summary).not.toContain('nor-this');
      expect(summary.length).toBeLessThan(800);
    });
  });
});
