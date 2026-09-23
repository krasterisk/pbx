import * as fs from 'fs';
import * as path from 'path';
import { UserLevel } from '../users/user.model';
import { SpeechAnalyticsAiAdapter } from './speech-analytics-ai.adapter';
import { stampChanged, type EditorProjectState } from './projects/project-editor.service';
import { defaultSaProjectConfig } from '@krasterisk/shared';

const TENANT_A = 100;
const TENANT_B = 200;
const PROJECT_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee1501';
const OPERATION_ID = '11111111-1111-4111-8111-111111111111';

function getTool(adapter: SpeechAnalyticsAiAdapter, name: string) {
  const tool = adapter.getTools().find((row) => row.name === name);
  if (!tool) throw new Error(`missing tool ${name}`);
  return tool;
}

describe('SpeechAnalyticsAiAdapter', () => {
  let registry: { register: jest.Mock };
  let moduleSettings: {
    get: jest.Mock;
    setPauseNew: jest.Mock;
  };
  let projects: {
    getEditorState: jest.Mock;
    applyEditorUpdate: jest.Mock;
  };
  let tokens: {
    issueSpeechAnalyticsToken: jest.Mock;
  };
  let adapter: SpeechAnalyticsAiAdapter;

  const mutationCtx = {
    vpbxUserUid: TENANT_A,
    userUid: 7,
    role: UserLevel.ADMIN,
    isAdmin: true,
  };

  beforeEach(() => {
    registry = { register: jest.fn() };
    moduleSettings = {
      get: jest.fn(async () => ({
        pauseNew: false,
        sttModelId: 'stt-a',
        scoreModelId: 'score-a',
        insightsModelId: null,
        cabinetCanEditModels: false,
        modelAllowlist: ['stt-a', 'score-a'],
      })),
      setPauseNew: jest.fn(async (_uid: number, pauseNew: boolean) => ({ pauseNew })),
    };
    projects = {
      getEditorState: jest.fn(async () => {
        const draft = defaultSaProjectConfig();
        draft.customMetrics = [{ id: 'm1', name: 'Greeting', type: 'boolean' }];
        const state: EditorProjectState = {
          draft,
          draftRevision: 2,
          published: defaultSaProjectConfig(),
          versionNo: 1,
          versions: [],
        };
        return state;
      }),
      applyEditorUpdate: jest.fn(async () => ({ published: true, versionNo: 2 })),
    };
    tokens = {
      issueSpeechAnalyticsToken: jest.fn(async () => ({
        principalId: 'prin-1',
        projectId: PROJECT_ID,
        token: 'sa-secret-ONCE-only',
        replay: false,
      })),
    };
    adapter = new SpeechAnalyticsAiAdapter(
      moduleSettings as any,
      projects as any,
      tokens as any,
      registry as any,
    );
  });

  it('registers with the AI adapter registry and pairs with the module skill', () => {
    adapter.onModuleInit();
    expect(registry.register).toHaveBeenCalledWith(adapter);
    const skillPath = path.join(__dirname, '../../skills/speech-analytics/SKILL.md');
    expect(fs.existsSync(skillPath)).toBe(true);
    const skill = fs.readFileSync(skillPath, 'utf8');
    expect(skill).toMatch(/name:\s*speech-analytics/);
    expect(skill).toMatch(/pause_speech_analytics|issue_speech_analytics_token|edit_speech_analytics_project/);
  });

  it('exposes pause, project edit, and token issue proposing tools', () => {
    const names = adapter.getTools().map((tool) => tool.name);
    expect(names).toEqual(expect.arrayContaining([
      'pause_speech_analytics',
      'edit_speech_analytics_project',
      'issue_speech_analytics_token',
    ]));
    expect(getTool(adapter, 'pause_speech_analytics').proposes).toBe(true);
    expect(getTool(adapter, 'edit_speech_analytics_project').proposes).toBe(true);
    expect(getTool(adapter, 'issue_speech_analytics_token').proposes).toBe(true);
  });

  it('issues a token with secret only in apply result; proposal and chat history omit the secret (D-33)', async () => {
    const tool = getTool(adapter, 'issue_speech_analytics_token');
    const proposal = await tool.handler(
      { name: 'CRM', project_id: PROJECT_ID },
      TENANT_A,
      { userUid: 7, role: UserLevel.ADMIN, threadUid: 1 },
    );
    expect(tokens.issueSpeechAnalyticsToken).not.toHaveBeenCalled();
    expect(JSON.stringify(proposal)).not.toContain('sa-secret-ONCE-only');
    expect((proposal as any).after?.secretOnce).toBe(true);
    expect((proposal as any).after?.secret).toBeUndefined();
    expect((proposal as any).after?.token).toBeUndefined();

    const history = adapter.toChatHistoryProposal(proposal as any);
    expect(JSON.stringify(history)).not.toMatch(/sa-secret|secret["']?\s*:/i);

    const applied = await tool.mutation!.apply(
      { name: 'CRM', project_id: PROJECT_ID, operation_id: OPERATION_ID },
      mutationCtx,
    );
    expect(tokens.issueSpeechAnalyticsToken).toHaveBeenCalled();
    expect((applied as any).secret).toBe('sa-secret-ONCE-only');
    expect(JSON.stringify(adapter.toChatHistoryProposal({
      ...(proposal as any),
      after: { ...(proposal as any).after, secret: (applied as any).secret },
    }))).not.toContain('sa-secret-ONCE-only');
  });

  it('publishes project edit when metrics change and uses dispatch tenant uid only (D-27, T-18-15-TENANT)', async () => {
    const tool = getTool(adapter, 'edit_speech_analytics_project');
    const proposal = await tool.handler(
      {
        project_id: PROJECT_ID,
        config: {
          customMetrics: [{ id: 'm2', name: 'Bye', type: 'boolean' }],
        },
      },
      TENANT_A,
      { userUid: 7, role: UserLevel.ADMIN, threadUid: 1 },
    );
    expect((proposal as any).after?.publish).toBe(true);
    expect(stampChanged).toBeDefined();

    await expect(
      tool.handler(
        {
          project_id: PROJECT_ID,
          config: { customMetrics: [{ id: 'm2', name: 'Bye', type: 'boolean' }] },
          vpbx_user_uid: TENANT_B,
        },
        TENANT_A,
      ),
    ).rejects.toThrow(/TENANT_ARG_FORBIDDEN/);

    await tool.mutation!.apply(
      {
        project_id: PROJECT_ID,
        expected_revision: 2,
        config: { customMetrics: [{ id: 'm2', name: 'Bye', type: 'boolean' }] },
        publish: true,
      },
      { ...mutationCtx, vpbxUserUid: TENANT_A },
    );
    expect(projects.applyEditorUpdate).toHaveBeenCalledWith(
      TENANT_A,
      expect.objectContaining({ projectId: PROJECT_ID, publish: true }),
    );
    expect(projects.applyEditorUpdate).not.toHaveBeenCalledWith(
      TENANT_B,
      expect.anything(),
    );
  });

  it('metric-only apply merges onto live draft and preserves non-metric sections (CR-01, D-27)', async () => {
    const seeded = defaultSaProjectConfig();
    seeded.customMetrics = [{ id: 'm1', name: 'Greeting', type: 'boolean' }];
    seeded.topics = ['upsell', 'retention-cr01'];
    seeded.eventWebhook = {
      url: 'https://hooks.example.test/sa-cr01',
      headers: { 'X-Hook': 'keep-me' },
      events: ['analysis.completed'],
    };
    seeded.digest = {
      ...seeded.digest,
      enabled: true,
      integrationUids: ['digest-uid-cr01'],
      schedule: 'daily',
    };
    seeded.alerts = {
      ...seeded.alerts,
      enabled: true,
      integrationUids: ['alert-uid-cr01'],
    };
    seeded.budget = { softLimit: 4242 };
    seeded.systemPrompt = 'CR-01 keep this system prompt';

    projects.getEditorState.mockImplementation(async (tenantUid: number) => {
      expect(tenantUid).toBe(TENANT_A);
      const state: EditorProjectState = {
        draft: seeded,
        draftRevision: 2,
        published: defaultSaProjectConfig(),
        versionNo: 1,
        versions: [],
      };
      return state;
    });

    const tool = getTool(adapter, 'edit_speech_analytics_project');
    const metricOnly = {
      customMetrics: [{ id: 'm2', name: 'Bye', type: 'boolean' }],
    };

    await tool.mutation!.apply(
      {
        project_id: PROJECT_ID,
        expected_revision: 2,
        config: metricOnly,
        publish: true,
      },
      { ...mutationCtx, vpbxUserUid: TENANT_A },
    );

    expect(projects.getEditorState).toHaveBeenCalledWith(TENANT_A, PROJECT_ID);
    expect(projects.applyEditorUpdate).toHaveBeenCalledWith(
      TENANT_A,
      expect.objectContaining({
        projectId: PROJECT_ID,
        expectedRevision: 2,
        publish: true,
        config: expect.objectContaining({
          customMetrics: metricOnly.customMetrics,
          topics: seeded.topics,
          eventWebhook: seeded.eventWebhook,
          digest: seeded.digest,
          alerts: seeded.alerts,
          budget: seeded.budget,
          systemPrompt: seeded.systemPrompt,
        }),
      }),
    );
    const appliedConfig = projects.applyEditorUpdate.mock.calls[0][1].config;
    const defaults = defaultSaProjectConfig();
    expect(appliedConfig.topics).not.toEqual(defaults.topics);
    expect(appliedConfig.eventWebhook.url).not.toBe(defaults.eventWebhook.url);
    expect(appliedConfig.digest.enabled).toBe(true);
    expect(appliedConfig.alerts.enabled).toBe(true);
    expect(appliedConfig.budget.softLimit).toBe(4242);
    expect(appliedConfig.systemPrompt).toBe('CR-01 keep this system prompt');
  });

  it('pauses new auto-analysis via module settings (D-19)', async () => {
    const tool = getTool(adapter, 'pause_speech_analytics');
    const proposal = await tool.handler({ pause_new: true }, TENANT_A);
    expect((proposal as any).after?.pauseNew).toBe(true);
    await tool.mutation!.apply({ pause_new: true }, mutationCtx);
    expect(moduleSettings.setPauseNew).toHaveBeenCalledWith(TENANT_A, true, expect.anything());
  });

  it('SpeechAnalyticsModule providers list includes SpeechAnalyticsAiAdapter and ModuleSettingsService (G-18-04)', () => {
    const modPath = path.join(__dirname, 'speech-analytics.module.ts');
    const source = fs.readFileSync(modPath, 'utf8');
    expect(source).toMatch(/SpeechAnalyticsAiAdapter/);
    expect(source).toMatch(/ModuleSettingsService/);
    expect(source).toMatch(/SA_AI_PROJECTS_PORT/);
    expect(source).toMatch(/SA_AI_TOKENS_PORT/);
    expect(source).not.toMatch(/analyst.?role|ROLE_ANALYST|createAnalyst/i);
  });
});
