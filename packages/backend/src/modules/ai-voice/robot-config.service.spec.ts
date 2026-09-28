import { AI_VOICE_ROBOT_DEFAULTS, validateAiVoiceConfig, type AiVoiceRobotConfig } from '@krasterisk/shared';
import { RobotConfigService, robotConfigFromRows } from './robot-config.service';

const configuration = (): AiVoiceRobotConfig => ({ ...structuredClone(AI_VOICE_ROBOT_DEFAULTS),
  name: 'Support', uniqueId: 'support', instruction: 'Help the caller', modelProfileId: 7 });

function fixture() {
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  const agent = { uid: 3, update: jest.fn().mockResolvedValue(undefined) };
  const draft = { robot_uuid: 'robot', draft_revision: 2, runtime_policy: '{}', update: jest.fn().mockResolvedValue(undefined) };
  const binding = { revision: 4, capture_policy: '{"mode":"allow","retentionDays":7}', update: jest.fn().mockResolvedValue(undefined) };
  const agents = { findOne: jest.fn().mockResolvedValueOnce(agent).mockResolvedValue(null), create: jest.fn() };
  const drafts = { findOne: jest.fn().mockResolvedValue(draft), create: jest.fn() };
  const versions = { max: jest.fn().mockResolvedValue(8), create: jest.fn().mockImplementation(async row => row) };
  const deployments = { findAll: jest.fn().mockResolvedValue([binding]), create: jest.fn() };
  const providers = { findOne: jest.fn().mockResolvedValue({ capabilities: ['realtime'], kind: 'online',
    vendor: 'openai', endpoint: 'https://provider.example/v1', auth_type: 'bearer',
    encrypted_api_key: 'must-not-copy', defaults: { model: 'voice-model', apiKey: 'must-not-copy' } }) };
  const products = { decide: jest.fn().mockResolvedValue({ allowed: true }) };
  const tools = { count: jest.fn().mockResolvedValue(0) };
  const bases = { count: jest.fn().mockResolvedValue(0) };
  const sequelize = { transaction: jest.fn().mockImplementation(callback => callback(transaction)) };
  const service = new RobotConfigService(sequelize as never, products as never, agents as never,
    providers as never, drafts as never, versions as never, deployments as never, tools as never, bases as never);
  return { service, transaction, agent, draft, binding, agents, drafts, versions, deployments, providers, products, tools };
}

describe('robot configuration validation', () => {
  it('accepts realtime configuration and requires all cascade providers', () => {
    expect(validateAiVoiceConfig(configuration())).toEqual([]);
    expect(validateAiVoiceConfig({ ...configuration(), mode: 'cascade' })).toEqual([
      { field: 'sttProfileId', code: 'required' }, { field: 'ttsProfileId', code: 'required' },
    ]);
  });
  it('returns issues instead of throwing for missing text fields', () => {
    expect(validateAiVoiceConfig({ ...configuration(), name: undefined, voice: undefined } as unknown as AiVoiceRobotConfig))
      .toEqual(expect.arrayContaining([{ field: 'name', code: 'required' }, { field: 'voice', code: 'required' }]));
  });
  it.each([NaN, Infinity, 0, -1, 1.5])('rejects invalid token limit %s', maxResponseOutputTokens => {
    expect(validateAiVoiceConfig({ ...configuration(), maxResponseOutputTokens }))
      .toContainEqual({ field: 'maxResponseOutputTokens', code: 'range' });
  });
  it('roundtrips extended settings while respecting canonical legacy agent fields', () => {
    const config = { ...configuration(), comment: 'Note', vadThreshold: 0.71, toolIds: ['tool-1'], analytic: false };
    const agent = { name: config.name, unique_id: config.uniqueId, enabled: config.enabled, mode: config.mode,
      voice: 'coral', greeting: config.greeting, instruction: config.instruction, model_profile_id: 7 };
    expect(robotConfigFromRows(agent as never, { runtime_policy: JSON.stringify({ settings: config }) } as never))
      .toEqual({ ...config, voice: 'coral' });
  });
  it('migrates legacy VAD and runtime values without losing their configuration', () => {
    const agent = { name: 'Old', unique_id: 'old', enabled: true, mode: 'cascade',
      vad_config: { threshold: 0.7, silenceMs: 900, prefixPaddingMs: 300 } };
    expect(robotConfigFromRows(agent as never, { runtime_policy: '{"maxCallMs":120000}' } as never))
      .toMatchObject({ vadThreshold: 0.7, silenceDurationMs: 900, prefixPaddingMs: 300, maxCallMs: 120000 });
  });
  it('bounds Unicode payload size for MySQL TEXT compatibility', () => {
    expect(validateAiVoiceConfig({ ...configuration(), instruction: 'Я'.repeat(30000) }))
      .toContainEqual({ field: 'instruction', code: 'length' });
  });
});

describe('RobotConfigService save', () => {
  it('creates an immutable full snapshot and advances only future-call bindings', async () => {
    const f = fixture();
    const config = { ...configuration(), analytic: false };
    const saved = await f.service.save(21, 99, config, 3, 2);
    expect(saved.revision).toBe(3);
    const version = f.versions.create.mock.calls[0][0];
    expect(JSON.parse(version.config).settings).toEqual(config);
    const snapshot = JSON.parse(version.config);
    expect(snapshot.providers.llm).toMatchObject({ id: version.llm_revision_id, providerUid: 7, tenantUid: 21,
      endpoint: 'https://provider.example/v1', defaults: { model: 'voice-model' } });
    expect(version.config).not.toContain('must-not-copy');
    expect(snapshot.policy.settings).toBeUndefined();
    expect(version).toMatchObject({ tenant_uid: 21, agent_uid: 3, version_no: 9, created_by: 99 });
    expect(f.binding.update).toHaveBeenCalledTimes(2);
    expect(JSON.parse(f.binding.update.mock.calls[0][0].capture_policy))
      .toEqual({ mode: 'allow', retentionDays: 7, analytic: false });
    expect(f.providers.findOne).toHaveBeenCalledWith({ where: { uid: 7, user_uid: 21, enabled: true, is_global: false }, transaction: f.transaction });
    expect(f.agent.update).toHaveBeenCalledWith(expect.any(Object), { transaction: f.transaction });
  });
  it.each([undefined, 1])('rejects missing or stale revision %s before writing', async revision => {
    const f = fixture();
    await expect(f.service.save(21, 99, configuration(), 3, revision)).rejects.toMatchObject({ status: revision ? 409 : 428 });
    expect(f.agent.update).not.toHaveBeenCalled();
    expect(f.versions.create).not.toHaveBeenCalled();
  });
  it('does not disclose another tenant robot', async () => {
    const f = fixture();
    f.agents.findOne.mockReset().mockResolvedValue(null);
    await expect(f.service.save(22, 99, configuration(), 3, 2)).rejects.toMatchObject({ status: 404 });
    expect(f.agents.findOne.mock.calls[0][0].where).toEqual({ uid: 3, user_uid: 22 });
    expect(f.versions.create).not.toHaveBeenCalled();
  });
  it('rejects unavailable provider and cross-tenant tool bindings', async () => {
    const f = fixture();
    f.providers.findOne.mockResolvedValue(null);
    await expect(f.service.save(21, 99, configuration(), 3, 2)).rejects.toMatchObject({ status: 400 });
    expect(f.agent.update).not.toHaveBeenCalled();
    const other = fixture();
    await expect(other.service.save(21, 99, { ...configuration(), toolIds: ['foreign'] }, 3, 2)).rejects.toMatchObject({ status: 400 });
    expect(other.agent.update).not.toHaveBeenCalled();
  });
  it('does not resurrect archived robots', async () => {
    const f = fixture();
    f.draft.runtime_policy = '{"archived":true}';
    await expect(f.service.save(21, 99, configuration(), 3, 2)).rejects.toMatchObject({ status: 404 });
  });
  it('fails closed when product access is denied', async () => {
    const f = fixture();
    f.products.decide.mockResolvedValue({ allowed: false });
    await expect(f.service.save(21, 99, configuration(), 3, 2)).rejects.toMatchObject({ status: 403 });
    expect(f.agents.findOne).not.toHaveBeenCalled();
  });
});
