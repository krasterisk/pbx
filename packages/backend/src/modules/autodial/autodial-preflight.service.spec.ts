import { AutodialPreflightService } from './autodial-preflight.service';

describe('read-only TTS capability metadata', () => {
  function serviceWith(rows: unknown[]) {
    const providers = {
      findAll: jest.fn(async (_tenant: number, capability: string) => capability === 'tts' ? rows : []),
      findGlobal: jest.fn(async () => []),
    };
    const service = new AutodialPreflightService({} as never, {} as never, {} as never, {} as never,
      {} as never, {} as never, { query: jest.fn(async () => []) } as never, providers as never);
    return { service, providers };
  }

  it('offers usable voice controls without exposing provider credentials or arbitrary defaults', async () => {
    const { service, providers } = serviceWith([
      { uid: 7, name: 'Google speech', enabled: true, is_global: false, vendor: 'google',
        endpoint: 'https://private.example/secret', encrypted_api_key: 'secret-cipher',
        defaults: { speaking_rate: '1.25', speed: 1.1, voice: 'private-default', apiKey: 'secret-key', customHeaders: { Authorization: 'secret-header' } } },
      { uid: 8, name: 'Off', enabled: false, is_global: false, vendor: 'yandex', defaults: { speed: 2 } },
      { uid: 9, name: 'Other vendor', enabled: true, is_global: true, vendor: 'azure', defaults: {} },
    ]);
    const result = await service.capabilities(42);
    expect(result.tts_engines).toEqual([
      { uid: 7, name: 'Google speech', is_global: false, type: 'google', settings: { speaking_rate: '1.25', speed: 1.1 } },
      { uid: 9, name: 'Other vendor', is_global: true, type: 'custom', settings: {} },
    ]);
    expect(JSON.stringify(result)).not.toMatch(/secret-|private-default|private\.example|customHeaders|encrypted_api_key/);
    expect(providers.findAll).toHaveBeenCalledWith(42, 'tts');
  });

  it.each(['secret-value', { nested: 'secret-value' }, true, -1, 0, 11, Infinity])('omits an invalid speed default %p', async (speed) => {
    const { service } = serviceWith([{ uid: 7, name: 'Speech', enabled: true, is_global: false, vendor: 'yandex', defaults: { speed, speaking_rate: 2 } }]);
    expect((await service.capabilities(42)).tts_engines).toEqual([
      { uid: 7, name: 'Speech', is_global: false, type: 'yandex', settings: { speaking_rate: 2 } },
    ]);
  });
});

describe('AutodialPreflightService', () => {
  function setup() {
    const campaign = { uid: 4, user_uid: 7, revision: 3, applied_revision: 3, apply_error: null as string | null, base_uid: 8, dial_mode: 'agentless',
      scenario_actions: [{ type: 'hangup', params: {} }], trunk_pool: [{ trunk_id: 't_ip_7' }], amd: { enabled: false } };
    const campaigns = { findOne: jest.fn().mockResolvedValue(campaign), validateConfiguration: jest.fn() };
    const registrations = jest.fn();
    const query = jest.fn(async (sql: string) => sql.includes('COUNT(DISTINCT') ? [{ count: '10' }] : []);
    const prompts = { resolvePromptAudioFile: jest.fn().mockResolvedValue(null) };
    const providers = { revisionForOperation: jest.fn().mockRejectedValue(new Error('Provider unavailable')),
      loadSpeechEngine: jest.fn().mockResolvedValue({ type: 'yandex' }) };
    const service = new AutodialPreflightService(campaigns as never,
      { diagnose: async () => ({ checked_at: '2026-10-16T08:00:00Z', schedule_open: false, ready_agents: 0 }) } as never,
      { assertAmdReady: jest.fn() } as never, { isConnected: () => true, pjsipShowRegistrations: registrations } as never,
      { isConnected: () => true } as never, prompts as never, { query, getDialect: () => 'mysql' } as never, providers as never);
    return { service, campaign, campaigns, query, prompts, registrations, providers };
  }
  it('treats a closed schedule as waiting and does not demand registration from an IP trunk', async () => {
    const { service, registrations } = setup();
    const result = await service.check(7, 4);
    expect(result.ready).toBe(true);
    expect(result.eligible_numbers).toBe(10);
    expect(result.checks).toContainEqual({ id: 'schedule', status: 'warning', code: 'outside_schedule' });
    expect(registrations).not.toHaveBeenCalled();
  });
  it('checks an unsaved draft without loading or creating a campaign', async () => {
    const { service, campaigns, query } = setup();
    const result = await service.checkDraft(7, { name: 'Draft', base_uid: 8, dial_mode: 'agentless',
      scenario_actions: [{ type: 'hangup', params: {} }], trunk_pool: [{ trunk_id: 't_ip_7' }] });
    expect(result).toMatchObject({ campaign_uid: 0, revision: 0, ready: true, eligible_numbers: 10 });
    expect(campaigns.findOne).not.toHaveBeenCalled();
    expect(query.mock.calls.every(([sql]) => !/INSERT|UPDATE|DELETE/i.test(sql))).toBe(true);
  });
  it('does not present connected AMI and ARI as readiness when the saved scenario was not applied', async () => {
    const { service, campaign } = setup();
    campaign.applied_revision = 2;
    expect(await service.check(7, 4)).toMatchObject({ ready: false, checks: expect.arrayContaining([
      { id: 'applied_revision', status: 'fail', code: 'dialplan_revision_pending' },
    ]) });
    campaign.apply_error = 'AC_DIALPLAN_APPLY_FAILED';
    expect(await service.check(7, 4)).toMatchObject({ ready: false, checks: expect.arrayContaining([
      { id: 'applied_revision', status: 'fail', code: 'dialplan_apply_failed' },
    ]) });
  });
  it('requires an actual tenant engine for TTS before a proposal exists', async () => {
    const { service, providers } = setup();
    await expect(service.validateDraft(7, { base_uid: 8, scenario_actions: [{ type: 'text2speech', params: { text: 'Hi', engine: 42 } }] }))
      .rejects.toMatchObject({ response: { code: 'AC_TTS_REQUIRED' } });
    expect(providers.revisionForOperation).toHaveBeenCalledWith(7, 42, 'tts');
  });
  it('does not approve a missing prompt', async () => {
    const { service, prompts } = setup();
    await expect(service.validateDraft(7, { base_uid: 8, scenario_actions: [{ type: 'collect_input', params: { promptFile: 'question' } }] }))
      .rejects.toMatchObject({ response: { code: 'AC_PROMPT_NOT_FOUND' } });
    expect(prompts.resolvePromptAudioFile).toHaveBeenCalledWith(7, 'question');
  });
  it('blocks an enabled provider whose stored credentials cannot be decrypted', async () => {
    const { service, providers } = setup(); providers.revisionForOperation.mockResolvedValue({} as never);
    providers.loadSpeechEngine.mockRejectedValue(new Error('secret authentication failed'));
    await expect(service.validateDraft(7, { base_uid: 8, scenario_actions: [{ type: 'text2speech', params: { text: 'Hi', engine: 42 } }] }))
      .rejects.toMatchObject({ response: { code: 'AC_TTS_CREDENTIAL_UNAVAILABLE' } });
  });
  it('blocks execution when configuration validation fails', async () => {
    const { service, campaigns } = setup();
    campaigns.validateConfiguration.mockRejectedValue(new Error('Invalid scenario'));
    await expect(service.assertReady(7, 4)).rejects.toMatchObject({ response: { code: 'AC_PREFLIGHT_FAILED' } });
  });
});
