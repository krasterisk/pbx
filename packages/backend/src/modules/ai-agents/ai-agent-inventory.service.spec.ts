import { AiAgentInventoryService } from './ai-agent-inventory.service';

function provider(uid: number, userUid: number, capabilities: string[], enabled = true) {
  return { uid, user_uid: userUid, capabilities, enabled } as any;
}

describe('AiAgentInventoryService', () => {
  it('uses exact tenant ownership and reports unavailable cascade dependencies', async () => {
    const agents = [{
      uid: 1,
      name: 'Cascade',
      mode: 'cascade',
      enabled: true,
      model_profile_id: 10,
      stt_profile_id: 11,
      tts_profile_id: 12,
      toolset_id: 13,
    }];
    const agentModel = { findAll: jest.fn().mockResolvedValue(agents) };
    const providerModel = { findAll: jest.fn().mockResolvedValue([
      provider(10, 42, ['llm']),
      provider(11, 42, ['stt'], false),
    ]) };
    const toolsetModel = { findAll: jest.fn().mockResolvedValue([]) };
    const service = new AiAgentInventoryService(agentModel as any, providerModel as any, toolsetModel as any);

    await expect(service.listForTenant(42)).resolves.toEqual([expect.objectContaining({
      uid: 1,
      readiness: { ready: false, issues: expect.arrayContaining([
        { code: 'disabled_provider', role: 'stt', referenceUid: 11 },
        { code: 'missing_provider', role: 'tts', referenceUid: 12 },
        { code: 'missing_toolset', role: 'toolset', referenceUid: 13 },
      ]) },
    })]);
    expect(providerModel.findAll).toHaveBeenCalledWith({
      where: { user_uid: 42, uid: expect.anything() },
      attributes: ['uid', 'user_uid', 'enabled', 'capabilities'],
    });
    expect(toolsetModel.findAll).toHaveBeenCalledWith({
      where: { user_uid: 42, uid: expect.anything() }, attributes: ['uid'],
    });
  });

  it('accepts a realtime-capable model profile and does not require cascade links', async () => {
    const agentModel = { findAll: jest.fn().mockResolvedValue([{
      uid: 2, name: 'Realtime', mode: 'realtime', enabled: true, model_profile_id: 20,
    }]) };
    const providerModel = { findAll: jest.fn().mockResolvedValue([provider(20, 0, ['realtime'])]) };
    const toolsetModel = { findAll: jest.fn().mockResolvedValue([]) };
    const service = new AiAgentInventoryService(agentModel as any, providerModel as any, toolsetModel as any);

    await expect(service.listForTenant(0)).resolves.toEqual([expect.objectContaining({
      readiness: { ready: true, issues: [] },
    })]);
  });

  it('paginates in stable UID order without selecting secrets or exposing foreign providers', async () => {
    const agentModel = { findAll: jest.fn().mockResolvedValue([
      { uid: 1, name: 'A', mode: 'realtime', enabled: true, model_profile_id: 20 },
      { uid: 2, name: 'B', mode: 'realtime', enabled: true, model_profile_id: 21 },
    ]) };
    const providerModel = { findAll: jest.fn().mockResolvedValue([
      provider(20, 9, ['realtime']), // malicious/incorrect repository row must not authorize tenant 42
    ]) };
    const toolsetModel = { findAll: jest.fn() };
    const service = new AiAgentInventoryService(agentModel as any, providerModel as any, toolsetModel as any);
    const page = await service.listPageForTenant(42, 1, 0);
    expect(page.nextCursor).toBe(1);
    expect(page.items[0].readiness).toMatchObject({ ready: false, issues: [
      { code: 'missing_provider', role: 'model', referenceUid: 20 },
    ] });
    expect(agentModel.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { user_uid: 42 }, order: [['uid', 'ASC']], limit: 2,
    }));
    expect(JSON.stringify(agentModel.findAll.mock.calls[0][0])).not.toContain('instruction');
    expect(JSON.stringify(providerModel.findAll.mock.calls[0][0])).not.toContain('encrypted_api_key');
    await expect(service.listPageForTenant(42, 101)).rejects.toThrow();
  });

  it('reports tenant-zero duplicate unique IDs and invalid historical references without writes', async () => {
    const agentModel = { findAll: jest.fn().mockResolvedValue([
      { uid: 1, unique_id: 'sales', name: 'Old A', mode: 'realtime', enabled: false, model_profile_id: 9 },
      { uid: 2, unique_id: 'sales', name: 'Old B', mode: 'cascade', enabled: false, model_profile_id: 9 },
    ]) };
    const providerModel = { findAll: jest.fn().mockResolvedValue([]) };
    const toolsetModel = { findAll: jest.fn() };
    const service = new AiAgentInventoryService(agentModel as any, providerModel as any, toolsetModel as any);
    const report = await service.reportLegacyForTenant(0);
    expect(report).toMatchObject({
      tenantUid: 0, scanned: 2, truncated: false,
      duplicateUniqueIds: [{ uniqueId: 'sales', uids: [1, 2] }],
    });
    expect(report.invalidAgents).toHaveLength(2);
    expect(agentModel.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { user_uid: 0 },
    }));
  });
});
