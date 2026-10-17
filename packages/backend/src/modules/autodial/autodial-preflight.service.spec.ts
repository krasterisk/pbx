import { AutodialPreflightService } from './autodial-preflight.service';

describe('AutodialPreflightService', () => {
  function setup() {
    const campaign = { uid: 4, user_uid: 7, revision: 3, base_uid: 8, dial_mode: 'agentless',
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
