import * as fs from 'fs';
import * as path from 'path';
import { Logger, NotFoundException } from '@nestjs/common';
import { UserLevel } from '../users/user.model';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import { McpToolsService } from '../mcp/mcp-tools.service';
import { AutodialAiAdapter } from './autodial-ai.adapter';

const TENANT_A = 100;
const TENANT_B = 200;

const BASE_A = {
  uid: 8,
  name: 'Loopback',
  contact_count: 2,
  dedup_policy: 'phone',
  fields: [{ key: 'phone', label: 'Phone', type: 'string', is_phone: true, var_name: 'PHONE' }],
};

const CAMPAIGN_A = {
  uid: 11,
  name: 'MCP Live',
  status: 'draft',
  dial_mode: 'progressive',
  base_uid: 8,
  pacing: { providers: [{ type: 'static', max_channels: 2 }], power_ratio: 2 },
  retry: { max_attempts: 3, default_interval_sec: 3600, intervals_sec: {} },
  trunk_pool: [{ trunk_id: 't_test_trunk_0', max_channels: 1 }],
  cid_policy: { mode: 'per_trunk' },
  queue_names: [],
  scenario_actions: [],
  amd: { enabled: false, on_machine: 'hangup', message_prompt: null },
  success_min_sec: 15,
  dial_timeout_sec: 45,
  revision: 3,
  tasks_total: 2,
  tasks_pending: 2,
  tasks_done: 0,
  schedules: [],
};

function createMcp(registry: AiAdapterRegistryService): McpToolsService {
  return new McpToolsService(
    registry,
    { logAction: jest.fn().mockResolvedValue(undefined) } as any,
    { createProposal: jest.fn(async (proposal: any) => ({ ...proposal, status: 'pending' })) } as any,
  );
}

describe('AutodialAiAdapter', () => {
  let campaigns: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    pause: jest.Mock;
  };
  let bases: { findAll: jest.Mock; findOne: jest.Mock };
  let reports: { summary: jest.Mock; reportingTimezone: jest.Mock };
  let dnc: { create: jest.Mock };
  let registry: { register: jest.Mock };
  let preflight: { validateDraft: jest.Mock; capabilities: jest.Mock; check: jest.Mock };
  let adapter: AutodialAiAdapter;

  const getTool = (name: string) => adapter.getTools().find((tool) => tool.name === name)!;

  beforeEach(() => {
    campaigns = {
      findAll: jest.fn(async (uid: number) => (uid === TENANT_A ? [CAMPAIGN_A] : [])),
      findOne: jest.fn(async (uid: number, campaignUid: number) => {
        if (uid !== TENANT_A || campaignUid !== 11) throw new NotFoundException('missing');
        return CAMPAIGN_A;
      }),
      create: jest.fn(async () => ({ ...CAMPAIGN_A, uid: 12, name: 'Created', status: 'draft', revision: 1 })),
      update: jest.fn(async (_uid: number, campaignUid: number, dto: Record<string, unknown>) => ({
        ...CAMPAIGN_A,
        uid: campaignUid,
        ...dto,
        revision: CAMPAIGN_A.revision + 1,
      })),
      pause: jest.fn(),
    };
    bases = {
      findAll: jest.fn(async (uid: number) => (uid === TENANT_A ? [BASE_A] : [])),
      findOne: jest.fn(async (uid: number, baseUid: number) => {
        if (uid !== TENANT_A || baseUid !== 8) throw new NotFoundException('missing base');
        return BASE_A;
      }),
    };
    reports = { summary: jest.fn(async () => []), reportingTimezone: jest.fn(async () => 'Asia/Krasnoyarsk') };
    dnc = { create: jest.fn() };
    registry = { register: jest.fn() };
    preflight = { validateDraft: jest.fn().mockResolvedValue(undefined), capabilities: jest.fn(), check: jest.fn() };
    adapter = new AutodialAiAdapter(
      campaigns as any,
      bases as any,
      reports as any,
      dnc as any,
      registry as any,
      { diagnose: jest.fn().mockResolvedValue({ next_attempt_at: '2026-10-17T02:14:00Z' }) } as any,
      preflight as any,
      { getTools: () => [] } as any,
    );
  });

  it('returns an explicit tenant timezone and local retry time for model diagnosis', async () => {
    const result = await getTool('get_autodial_diagnosis').handler!({ uid: 11 }, TENANT_A);
    expect(result).toMatchObject({ timezone: 'Asia/Krasnoyarsk', next_attempt_at: '2026-10-17T02:14:00Z' });
    expect((result as { next_attempt_local: string }).next_attempt_local).toContain('09:14');
    expect(reports.reportingTimezone).toHaveBeenCalledWith(TENANT_A);
  });

  describe('tool declarations', () => {
    it('exposes list, get, create, update, pause and dnc', () => {
      expect(adapter.getTools().map((tool) => tool.name)).toEqual([
        'list_autodial_campaigns',
        'get_autodial_campaign',
        'list_autodial_bases',
        'get_autodial_stats',
        'create_autodial_campaign',
        'update_autodial_campaign',
        'pause_autodial_campaign',
        'add_autodial_dnc',
        'describe_autodial_capabilities',
        'get_autodial_base',
        'get_autodial_diagnosis',
        'get_autodial_preflight',
        'get_autodial_monitor',
        'list_autodial_dnc',
      ]);
    });

    it('does not expose start', () => {
      expect(adapter.getTools().some((tool) => tool.name.includes('start'))).toBe(false);
    });

    it('marks create and update as proposing tools', () => {
      expect(getTool('create_autodial_campaign').proposes).toBe(true);
      expect(getTool('update_autodial_campaign').proposes).toBe(true);
      expect(getTool('create_autodial_campaign').mutation).toBeDefined();
      expect(getTool('update_autodial_campaign').mutation).toBeDefined();
    });
  });

  describe('create_autodial_campaign', () => {
    it('reviews and freezes a safe speech failure default without mutating the model input', async () => {
      const action = { type: 'text2speech', params: { engine: 3, text: 'Test' } };
      const proposal = await getTool('create_autodial_campaign').handler({ name: 'Safe new draft', base_uid: 8,
        scenario_actions: [action] }, TENANT_A);
      expect(proposal.applyPayload.args.scenario_actions[0].params.onFailure).toBe('hangup');
      expect(proposal.summary).toContain('Шаг 1: при ошибке озвучивания — завершить звонок');
      expect(action.params).not.toHaveProperty('onFailure');
      expect(preflight.validateDraft).toHaveBeenCalledWith(TENANT_A,
        expect.objectContaining({ scenario_actions: [expect.objectContaining({ params: expect.objectContaining({ onFailure: 'hangup' }) })] }));
    });
    it('keeps an explicitly chosen continuation policy', async () => {
      const proposal = await getTool('create_autodial_campaign').handler({ name: 'Explicit policy', base_uid: 8,
        scenario_actions: [{ type: 'text2speech', params: { engine: 3, text: 'Test', onFailure: 'continue' } }] }, TENANT_A);
      expect(proposal.applyPayload.args.scenario_actions[0].params.onFailure).toBe('continue');
      expect(proposal.summary).toContain('Шаг 1: при ошибке озвучивания — продолжить с сохранением ошибки');
    });
    it('keeps the business goal and exposes reviewable rules and branches without raw action parameters', async () => {
      const proposal = await getTool('create_autodial_campaign').handler({ name: 'Appointment review', base_uid: 8,
        dial_mode: 'agentless', business_goal: 'appointment', retry: { max_attempts: 1, default_interval_sec: 60 },
        pacing: { providers: [{ type: 'static', max_channels: 1 }] },
        scenario_actions: [{ type: 'text2speech', params: { engine: 3, text: 'Private customer text {AC_NAME}' } },
          { type: 'collect_input', params: { outcomeMap: { '1': 'confirmed' }, outcomeDefinitions: {
            confirmed: { label: 'Запись подтверждена', category: 'positive', goal_relation: 'achieved' },
          } } }],
      }, TENANT_A);
      expect(proposal.after.business_goal).toBe('appointment');
      expect(proposal.applyPayload.args.business_goal).toBe('appointment');
      expect(proposal.summary).toEqual(expect.arrayContaining(['Цель: подтверждение записи', 'Максимум попыток: 1',
        'Ограничители набора: 1 кан.', 'Расписание: круглосуточно', 'Шагов разговора: 2',
        'Шаг 1: озвучивание, провайдер 3', 'Шаг 2: ввод 1 → Запись подтверждена']));
      expect(JSON.stringify(proposal.summary)).not.toContain('Private customer text');
      expect(campaigns.create).not.toHaveBeenCalled();
    });
    it('accepts a survey goal and describes it before applying', async () => {
      const proposal = await getTool('create_autodial_campaign').handler({ name: 'Survey', base_uid: 8,
        business_goal: 'survey', scenario_actions: [{ type: 'hangup', params: {} }] }, TENANT_A);
      expect(proposal.after.business_goal).toBe('survey');
      expect(proposal.applyPayload.args.business_goal).toBe('survey');
      expect(proposal.summary).toContain('Цель: получение ответа опроса');
      expect(campaigns.create).not.toHaveBeenCalled();
    });
    it('proposes a draft without writing until apply', async () => {
      const tool = getTool('create_autodial_campaign');
      const proposal = await tool.handler(
        {
          name: 'Loop test',
          base_uid: 8,
          dial_mode: 'agentless',
          trunk_pool: [{ trunk_id: 't_test_trunk_0', max_channels: 1 }],
        },
        TENANT_A,
      );

      expect(campaigns.create).not.toHaveBeenCalled();
      expect(proposal.after).toEqual(
        expect.objectContaining({ name: 'Loop test', status: 'draft', dial_mode: 'agentless' }),
      );
      await tool.mutation!.apply(proposal.applyPayload.args, {
        vpbxUserUid: TENANT_A,
        userUid: 1,
        role: UserLevel.ADMIN,
        isAdmin: true,
      });
      expect(campaigns.create).toHaveBeenCalledWith(
        TENANT_A,
        expect.objectContaining({ name: 'Loop test', base_uid: 8, dial_mode: 'agentless' }),
        1,
        expect.objectContaining({ source: 'ai_assistant' }),
      );
    });

    it('refuses a base from another tenant', async () => {
      const proposal = await getTool('create_autodial_campaign').handler(
        { name: 'X', base_uid: 8 },
        TENANT_B,
      );
      expect(proposal.refused).toBe(true);
      expect(campaigns.create).not.toHaveBeenCalled();
    });
  });

  describe('update_autodial_campaign', () => {
    it('does not silently migrate a legacy conversation when reviewing an update', async () => {
      const proposal = await getTool('update_autodial_campaign').handler({ uid: 11,
        scenario_actions: [{ type: 'text2speech', params: { engine: 3, text: 'Legacy' } }] }, TENANT_A);
      expect(proposal.applyPayload.args.scenario_actions[0].params).not.toHaveProperty('onFailure');
    });
    it('stamps expected_revision from the current row and writes only after apply', async () => {
      const tool = getTool('update_autodial_campaign');
      const proposal = await tool.handler(
        { uid: 11, dial_timeout_sec: 20, amd: { enabled: true, on_machine: 'voicemail', message_prompt: 'vm' } },
        TENANT_A,
      );

      expect(campaigns.update).not.toHaveBeenCalled();
      expect(proposal.applyPayload.args).toEqual(
        expect.objectContaining({ uid: 11, expected_revision: 3, dial_timeout_sec: 20 }),
      );
      await tool.mutation!.apply(proposal.applyPayload.args, {
        vpbxUserUid: TENANT_A,
        userUid: 1,
        role: UserLevel.ADMIN,
        isAdmin: true,
      });
      expect(campaigns.update).toHaveBeenCalledWith(
        TENANT_A,
        11,
        expect.objectContaining({
          expected_revision: 3,
          dial_timeout_sec: 20,
          amd: { enabled: true, on_machine: 'voicemail', message_prompt: 'vm' },
        }),
        1,
        expect.objectContaining({ source: 'ai_assistant' }),
      );
    });

    it('resolves the campaign by name and does not treat the lookup name as a rename', async () => {
      const proposal = await getTool('update_autodial_campaign').handler(
        { name: 'MCP Live', success_min_sec: 40 },
        TENANT_A,
      );
      expect(proposal.refused).toBeUndefined();
      expect(proposal.applyPayload.args.name).toBeUndefined();
      expect(proposal.applyPayload.args.success_min_sec).toBe(40);
    });

    it('refuses an empty patch', async () => {
      const proposal = await getTool('update_autodial_campaign').handler({ uid: 11 }, TENANT_A);
      expect(proposal.refused).toBe(true);
      expect(campaigns.update).not.toHaveBeenCalled();
    });

    it('revalidate fails when the revision moved', async () => {
      const tool = getTool('update_autodial_campaign');
      campaigns.findOne.mockResolvedValueOnce({ ...CAMPAIGN_A, revision: 9 });
      const result = await tool.mutation!.revalidate(
        { uid: 11, expected_revision: 3, dial_timeout_sec: 20 },
        { vpbxUserUid: TENANT_A, userUid: 1, role: UserLevel.ADMIN, isAdmin: true },
      );
      expect(result.ok).toBe(false);
    });
  });

  describe('get_autodial_campaign', () => {
    it('returns the full snapshot for the owning tenant', async () => {
      const result = await getTool('get_autodial_campaign').handler({ uid: 11 }, TENANT_A);
      expect(result.campaign).toEqual(
        expect.objectContaining({
          uid: 11,
          trunk_pool: CAMPAIGN_A.trunk_pool,
          amd: CAMPAIGN_A.amd,
          revision: 3,
        }),
      );
    });

    it('does not leak another tenant campaign by name', async () => {
      const result = await getTool('get_autodial_campaign').handler({ name: 'MCP Live' }, TENANT_B);
      expect(result.refused).toBe(true);
    });
  });

  describe('adapter precedence (D-27)', () => {
    it('registers create/update once through MCP', () => {
      const live = new AiAdapterRegistryService();
      const wired = new AutodialAiAdapter(
        campaigns as any,
        bases as any,
        reports as any,
        dnc as any,
        live,
        { diagnose: jest.fn() } as any,
        { validateDraft: jest.fn().mockResolvedValue(undefined), capabilities: jest.fn(), check: jest.fn() } as any,
        { getTools: () => [] } as any,
      );
      wired.onModuleInit();
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      const mcp = createMcp(live);
      mcp.registerAll();
      for (const name of ['create_autodial_campaign', 'update_autodial_campaign', 'get_autodial_campaign']) {
        expect(live.getToolByName(name)).toBeDefined();
        expect(mcp.getToolsList(TENANT_A).filter((tool) => tool.name === name)).toHaveLength(1);
      }
      warnSpy.mockRestore();
    });
  });

  describe('autodial domain skill', () => {
    it('documents create/update and keeps start as a human action', () => {
      const skillPath = path.join(__dirname, '../../skills/autodial/SKILL.md');
      const raw = fs.readFileSync(skillPath, 'utf8');
      expect(raw).toMatch(/^---\r?\nname: autodial\r?\ndescription: .+/);
      expect(raw).toMatch(/create_autodial_campaign/);
      expect(raw).toMatch(/update_autodial_campaign/);
      expect(raw).toMatch(/get_autodial_campaign/);
      expect(raw).toMatch(/Запуск кампании агенту недоступен/);
    });
  });
});
