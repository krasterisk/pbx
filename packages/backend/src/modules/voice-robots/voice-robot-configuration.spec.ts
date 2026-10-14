import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { VoiceRobotConfigurationService } from './voice-robot-configuration.service';
import { VoiceRobotToolsService } from './voice-robot-tools.service';
import { VoiceRobotsAiAdapter } from './voice-robots-ai.adapter';
import { requireScenario, validateScenario } from './voice-robot-scenario';
import { parseMutationArgs, parseMutationInput } from '../ai-platform/ai-mutation.contract';
import { assertNoSecretArgs, redactSecrets } from '../ai-platform/ai-secret-redaction';

const example = (name = 'basic') => JSON.parse(readFileSync(resolve(__dirname, '../../../../../deploy/voice-robots-standalone/public/examples', name + '.scenario.json'), 'utf8'));
function fixture() {
  let rows: Record<string, any[]> = { robots: [], groups: [], keywords: [], lists: [] }; let next = 100;
  let failKeyword = false;
  const model = (kind: string) => ({
    findOne: jest.fn(async ({ where }: any) => { const row = rows[kind].find(r => Object.entries(where).every(([k, v]) => r[k] === v)); return row && wrap(kind, row); }),
    findAll: jest.fn(async ({ where }: any) => rows[kind].filter(r => Object.entries(where).every(([k, v]) => r[k] === v)).map(row => wrap(kind, row))),
    create: jest.fn(async (data: any) => {
      if (kind === 'keywords' && failKeyword) throw new Error('Injected DB failure');
      const defaults = kind === 'robots' ? { name: '', active: 0, description: null, initial_group_id: null, greeting_tts_text: null, fallback_bot_action: null, max_retries_bot_action: null }
        : kind === 'groups' ? { priority: 0, active: 1, is_global: 0, description: null }
          : kind === 'keywords' ? { priority: 0, max_repeats: 0, comment: null, tag: null, negative_keywords: [], synonyms: [], bot_action: null, escalation_action: null } : {};
      const row = { uid: ++next, ...defaults, ...JSON.parse(JSON.stringify(data)) }; rows[kind].push(row); return wrap(kind, row);
    }),
  });
  const wrap = (kind: string, row: any): any => ({ ...row, toJSON: () => structuredClone(row),
    update: async (data: any) => { Object.assign(row, JSON.parse(JSON.stringify(data))); return wrap(kind, row); },
    destroy: async () => { rows[kind] = rows[kind].filter(r => r.uid !== row.uid); },
  });
  const robots = model('robots'); const groups = model('groups'); const keywords = model('keywords'); const lists = model('lists');
  (robots as any).sequelize = { transaction: async (fn: any) => { const before = structuredClone(rows); try { return await fn({ LOCK: { UPDATE: 'UPDATE' } }); } catch (error) { rows = before; throw error; } } };
  const providers = { loadSpeechEngine: jest.fn(async (tenant: number, uid: number) => { if (tenant !== 7 || uid !== 88) throw new Error('Foreign engine'); return { name: 'Speech', type: 'yandex', token: 'never-expose' }; }), findAll: async () => [] };
  const config = new VoiceRobotConfigurationService(robots as never, groups as never, keywords as never, lists as never, providers as never, { assertNotReferenced: async () => {} } as never, { clearListCache: jest.fn() } as never);
  const tools = new VoiceRobotToolsService({} as never, config, providers as never);
  return { config, tools, rows: () => rows, fail: () => { failKeyword = true; }, providers, robots };
}
describe('robot scenario tools: tenant, transaction and mutation contract', () => {
  it.each(['basic', 'directory'])('validates public %s example and remaps every reference to newly created UIDs', async name => {
    const f = fixture(); const file = requireScenario(example(name));
    const result = await f.config.write('create_voice_robot', { data: { name: 'Test' }, scenario: file }, 7);
    expect(result.imported.groups).toBe(file.scenario.groups.length);
    const config = await f.config.configuration(7, result.robotId);
    expect(config.robot.active).toBe(0);
    expect(config.robot.initial_group_id).toBe(result.imported.groupIds['group:1']);
    expect(f.rows().groups.every(g => g.user_uid === 7 && g.robot_id === result.robotId)).toBe(true);
    for (const kw of f.rows().keywords) {
      if (kw.bot_action?.nextState.type === 'switch_group') expect(Object.values(result.imported.groupIds)).toContain(Number(kw.bot_action.nextState.target));
      if (kw.bot_action?.dataListSearch) {
        expect(kw.bot_action.dataListSearch.listId).toBe(result.imported.listIds['list:1']);
        expect(kw.bot_action.dataListSearch).not.toHaveProperty('listKey');
        expect(kw.bot_action.dataListSearch.onFoundNextState.target).toBe(String(result.imported.groupIds['group:1']));
      }
    }
    const exported = await f.config.exportScenario(7, result.robotId);
    expect(validateScenario(exported.file).valid).toBe(true);
  });
  it('rolls back robot, lists and groups when keyword creation fails', async () => {
    const f = fixture(); f.fail();
    await expect(f.config.write('create_voice_robot', { data: { name: 'Rollback' }, scenario: example('directory') }, 7)).rejects.toThrow('Injected DB');
    expect(Object.values(f.rows()).every(rows => rows.length === 0)).toBe(true);
  });
  it('does not expose foreign robots/children or accept tenant aliases and secret args', async () => {
    const f = fixture(); const r = await f.config.write('create_voice_robot', { data: { name: 'Owned' }, scenario: example() }, 7);
    await expect(f.config.configuration(8, r.robotId)).rejects.toThrow('not found');
    await expect(f.config.write('update_voice_robot_keyword', { uid: f.rows().keywords[0].uid, data: { comment: 'foreign' } }, 8)).rejects.toThrow('not found');
    await expect(f.config.write('update_voice_robot', { uid: r.robotId, data: { user_uid: 8 } }, 7)).rejects.toThrow('TENANT_ARG_FORBIDDEN');
    await expect(f.config.write('update_voice_robot', { uid: r.robotId, data: { token: 'leak' } }, 7)).rejects.toThrow('SECRET_ARG_FORBIDDEN');
    await expect(f.config.write('update_voice_robot', { uid: r.robotId, data: { stt_engine_id: 999 } }, 7)).rejects.toThrow('Foreign engine');
  });
  it('refuses dangling group deletion and data-list column edits atomically', async () => {
    const f = fixture(); const r = await f.config.write('create_voice_robot', { data: { name: 'Owned' }, scenario: example('directory') }, 7);
    await expect(f.config.write('delete_voice_robot_keyword_group', { uid: r.imported.groupIds['group:1'] }, 7)).rejects.toThrow('INVALID_SCENARIO');
    expect(f.rows().groups).toHaveLength(2);
    await expect(f.config.write('update_voice_robot_data_list', { uid: r.imported.listIds['list:1'], data: { columns: [{ key: 'city', label: 'City', searchable: true }] } }, 7)).rejects.toThrow();
    expect(f.rows().lists[0].columns).toHaveLength(2);
  });
  it('redacts custom auth header values from existing UI-created actions and refuses model-provided header secrets', async () => {
    const f = fixture(); const r = await f.config.write('create_voice_robot', { data: { name: 'Owned' }, scenario: example() }, 7);
    const action = { response: { type: 'none' }, nextState: { type: 'webhook', target: 'https://example.test' },
      webhookAuth: { mode: 'custom', customHeaders: [{ key: 'X-Integration', value: 'do-not-expose-header-value' }] } };
    f.rows().keywords[0].bot_action = action;
    expect(() => assertNoSecretArgs({ action })).toThrow('SECRET_ARG_FORBIDDEN');
    expect(JSON.stringify(redactSecrets({ action }))).not.toContain('do-not-expose-header-value');
    const configuration = await f.config.configuration(7, r.robotId);
    expect(JSON.stringify(configuration)).not.toContain('do-not-expose-header-value');
    const exported = await f.config.exportScenario(7, r.robotId);
    expect(exported.file.scenario.groups[0].keywords[0].bot_action!.webhookAuth).toEqual({ mode: 'none' });
    const tools = new VoiceRobotToolsService({ testMatch: async () => ({ match: { bot_action: action } }) } as never, f.config, f.providers as never);
    const tested = await tools.definitions().find(t => t.name === 'test_voice_robot_match')!.execute({ robotId: r.robotId, text: 'test' }, 7);
    expect(JSON.stringify(tested)).not.toContain('do-not-expose-header-value');
    await expect(f.config.write('update_voice_robot_keyword', { uid: f.rows().keywords[0].uid, data: { bot_action: action } }, 7)).rejects.toThrow('SECRET_ARG_FORBIDDEN');
  });
  it('base adapter proposes without writing, detects stale state, applies only with tenant context and never reloads', async () => {
    const f = fixture(); const r = await f.config.write('create_voice_robot', { data: { name: 'Original' }, scenario: example() }, 7);
    const adapter = new VoiceRobotsAiAdapter({} as never, f.providers as never, { register: jest.fn() } as never, undefined, f.tools);
    const tool = adapter.getTools().find(t => t.name === 'update_voice_robot')!;
    const ctx = { vpbxUserUid: 7, userUid: 2, role: 1, isAdmin: true };
    const input = parseMutationInput(tool.mutation!, { uid: r.robotId, data: { name: 'Changed' } });
    const proposal: any = await tool.mutation!.propose(input, ctx);
    expect(f.rows().robots[0].name).toBe('Original'); expect(proposal.includesDialplanReload).toBe(false);
    const args = parseMutationArgs(tool.mutation!, proposal.applyPayload.args);
    expect((await tool.mutation!.revalidate(args, ctx)).ok).toBe(true);
    await f.config.write('update_voice_robot', { uid: r.robotId, data: { description: 'Human concurrent edit' } }, 7);
    expect((await tool.mutation!.revalidate(args, ctx)).ok).toBe(false);
    await expect(tool.mutation!.apply(args, ctx)).rejects.toThrow('ROBOT_STATE_CHANGED');
    const fresh: any = await tool.mutation!.propose(input, ctx);
    await tool.mutation!.apply(parseMutationArgs(tool.mutation!, fresh.applyPayload.args), ctx);
    expect(f.rows().robots[0]).toMatchObject({ name: 'Changed', description: 'Human concurrent edit', user_uid: 7 });
    expect(JSON.stringify(fresh)).not.toContain('never-expose');
    expect(() => parseMutationInput(tool.mutation!, { uid: r.robotId, data: { external_host: 'evil' } })).toThrow();
    expect(() => parseMutationInput(tool.mutation!, { uid: r.robotId, data: { name: 'x', uid: 777 } })).toThrow();
  });
  it('rejects unresolved references, duplicate keys and runtime listId in portable files', () => {
    const file = example(); file.scenario.groups[0].keywords[0].bot_action.nextState.target = 'group:missing'; expect(validateScenario(file).valid).toBe(false);
    const duplicate = example(); duplicate.scenario.groups[1].key = 'group:1'; expect(validateScenario(duplicate).valid).toBe(false);
    const list = example('directory'); list.scenario.groups[0].keywords[0].bot_action.dataListSearch.listId = 5; expect(validateScenario(list).valid).toBe(false);
  });
});
