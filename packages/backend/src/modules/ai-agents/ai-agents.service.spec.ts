import { AiAgentsService } from './ai-agents.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

/**
 * AI Agents CRUD tests — focus on validation rules:
 *   - cascade requires STT + TTS profile
 *   - all profiles must belong to the exact tenant and match their role
 *   - unique_id is unique per tenant
 *   - unique_id only contains [A-Za-z0-9_-]
 */
describe('AiAgentsService', () => {
  const profile = (uid: number, userUid = 7, capabilities = ['realtime'], enabled = true) =>
    ({ uid, user_uid: userUid, capabilities, enabled });
  let agentModel: any;
  let providerModel: any;
  let toolsetModel: any;
  let draftModel: any;
  let service: AiAgentsService;

  beforeEach(() => {
    agentModel = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((row: any) => Promise.resolve({ uid: 1, ...row })),
    };
    providerModel = {
      findAll: jest.fn().mockResolvedValue([]),
    };
    toolsetModel = {
      findOne: jest.fn(),
    };
    draftModel = {
      findOne: jest.fn().mockResolvedValue({
        tenant_uid: 7, agent_uid: 5, robot_uuid: 'robot-uuid', draft_revision: 1,
        runtime_policy: '{}', save: jest.fn().mockResolvedValue(undefined),
      }),
      create: jest.fn().mockImplementation((row: any) => Promise.resolve({
        ...row, draft_revision: 1, robot_uuid: 'robot-uuid', save: jest.fn(),
      })),
    };
    service = new AiAgentsService(agentModel, providerModel, toolsetModel, draftModel);
  });

  // ─── unique_id validation ───────────────────────────────

  describe('unique_id', () => {
    it('rejects characters outside [A-Za-z0-9_-]', async () => {
      providerModel.findAll.mockResolvedValueOnce([profile(10)]);

      await expect(
        service.create({
          name: 'Bot',
          unique_id: 'has space',
          mode: 'realtime',
          model_profile_id: 10,
        } as any, 7),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects duplicates within the same tenant', async () => {
      providerModel.findAll.mockResolvedValue([profile(10)]);
      agentModel.findOne.mockResolvedValueOnce({ uid: 99 });

      await expect(
        service.create({
          name: 'Bot',
          unique_id: 'sales-bot',
          mode: 'realtime',
          model_profile_id: 10,
        } as any, 7),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ─── Mode consistency ──────────────────────────────────

  describe('mode consistency', () => {
    it('cascade mode requires STT profile', async () => {
      providerModel.findAll.mockResolvedValue([profile(10)]);
      agentModel.findOne.mockResolvedValueOnce(null); // unique-id check passes

      await expect(
        service.create({
          name: 'Bot',
          unique_id: 'sales',
          mode: 'cascade',
          model_profile_id: 10,
          tts_profile_id: 10,
        } as any, 7),
      ).rejects.toMatchObject({ response: expect.objectContaining({
        code: 'agent_configuration_not_ready',
        issues: expect.arrayContaining([{ code: 'missing_provider', role: 'stt', referenceUid: null }]),
      }) });
    });

    it('cascade mode requires TTS profile', async () => {
      providerModel.findAll.mockResolvedValue([profile(10)]);
      agentModel.findOne.mockResolvedValueOnce(null);

      await expect(
        service.create({
          name: 'Bot',
          unique_id: 'sales',
          mode: 'cascade',
          model_profile_id: 10,
          stt_profile_id: 10,
        } as any, 7),
      ).rejects.toMatchObject({ response: expect.objectContaining({
        issues: expect.arrayContaining([{ code: 'missing_provider', role: 'tts', referenceUid: null }]),
      }) });
    });

    it('any mode requires LLM/model profile', async () => {
      providerModel.findAll.mockResolvedValue([]);
      agentModel.findOne.mockResolvedValueOnce(null);

      await expect(
        service.create({
          name: 'Bot',
          unique_id: 'sales',
          mode: 'realtime',
        } as any, 7),
      ).rejects.toMatchObject({ response: expect.objectContaining({
        issues: expect.arrayContaining([{ code: 'missing_provider', role: 'model', referenceUid: null }]),
      }) });
    });
  });

  // ─── Cross-tenant linking rejection ─────────────────────

  describe('tenant-scoped linking', () => {
    it('rejects when a referenced provider is missing for this tenant', async () => {
      // The query returns nothing — provider belongs to another tenant
      providerModel.findAll.mockResolvedValue([]);
      agentModel.findOne.mockResolvedValueOnce(null);

      await expect(
        service.create({
          name: 'Bot',
          unique_id: 'sales',
          mode: 'realtime',
          model_profile_id: 999,
        } as any, 7),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a user_uid=0 provider for another tenant without an explicit grant', async () => {
      providerModel.findAll.mockResolvedValue([profile(10, 0)]);
      agentModel.findOne.mockResolvedValueOnce(null);

      await expect(service.create({
        name: 'Bot',
        unique_id: 'sales',
        mode: 'realtime',
        model_profile_id: 10,
      } as any, 7)).rejects.toMatchObject({ response: expect.objectContaining({
        issues: [{ code: 'missing_provider', role: 'model', referenceUid: 10 }],
      }) });
      expect(agentModel.create).not.toHaveBeenCalled();
      expect(providerModel.findAll).toHaveBeenCalledWith({
        where: { uid: expect.anything(), user_uid: 7 },
        attributes: ['uid', 'user_uid', 'enabled', 'capabilities'],
      });
    });

    it('rejects toolsets owned by another tenant', async () => {
      providerModel.findAll.mockResolvedValue([profile(10)]);
      toolsetModel.findOne.mockResolvedValueOnce(null);
      agentModel.findOne.mockResolvedValueOnce(null);

      await expect(
        service.create({
          name: 'Bot',
          unique_id: 'sales',
          mode: 'realtime',
          model_profile_id: 10,
          toolset_id: 50,
        } as any, 7),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ─── update / remove ────────────────────────────────────

  describe('update', () => {
    it('rejects when the agent does not belong to the tenant', async () => {
      agentModel.findOne.mockResolvedValueOnce(null);
      await expect(service.update(5, { name: 'x' } as any, 7, 1))
        .rejects.toBeInstanceOf(NotFoundException);
    });

    it('updates fields that pass validation', async () => {
      const update = jest.fn().mockResolvedValue(undefined);
      agentModel.findOne.mockResolvedValueOnce({
        uid: 5,
        unique_id: 'sales',
        mode: 'realtime',
        model_profile_id: 10,
        update,
        get() { return { uid: 5, unique_id: 'sales', mode: 'realtime', model_profile_id: 10 }; },
      });
      providerModel.findAll.mockResolvedValue([profile(10)]);

      await service.update(5, { name: 'New name' } as any, 7, 1);

      expect(update).toHaveBeenCalledWith({ name: 'New name' });
    });

    it('revalidates the stored provider on a partial update after it was disabled', async () => {
      const update = jest.fn();
      agentModel.findOne.mockResolvedValueOnce({
        uid: 5, unique_id: 'sales', update,
        get() { return { uid: 5, unique_id: 'sales', mode: 'realtime', enabled: true, model_profile_id: 10 }; },
      });
      providerModel.findAll.mockResolvedValue([profile(10, 7, ['realtime'], false)]);
      await expect(service.update(5, { name: 'Still running?' } as any, 7, 1))
        .rejects.toMatchObject({ response: expect.objectContaining({
          issues: [{ code: 'disabled_provider', role: 'model', referenceUid: 10 }],
        }) });
      expect(update).not.toHaveBeenCalled();
    });

    it('reports disabled-after-save readiness without exposing provider secrets', async () => {
      agentModel.findOne.mockResolvedValueOnce({
        get() { return { mode: 'realtime', model_profile_id: 10 }; },
      });
      providerModel.findAll.mockResolvedValue([profile(10, 7, ['realtime'], false)]);
      await expect(service.checkReadiness(5, 7)).resolves.toEqual({
        ready: false, issues: [{ code: 'disabled_provider', role: 'model', referenceUid: 10 }],
      });
      expect(providerModel.findAll).toHaveBeenCalledWith({
        where: { uid: expect.anything(), user_uid: 7 },
        attributes: ['uid', 'user_uid', 'enabled', 'capabilities'],
      });
    });

    it('permits disabling an invalid historical draft, then requires repair before enabling', async () => {
      const update = jest.fn().mockResolvedValue(undefined);
      const legacy = { uid: 5, unique_id: 'legacy', mode: 'realtime', enabled: true, model_profile_id: 999 };
      agentModel.findOne.mockResolvedValue({
        ...legacy, update, get() { return legacy; },
      });
      await service.update(5, { enabled: false } as any, 7, 1);
      expect(update).toHaveBeenCalledWith({ enabled: false });
      await expect(service.update(5, { enabled: true } as any, 7, 2))
        .rejects.toMatchObject({ response: expect.objectContaining({
          issues: [{ code: 'missing_provider', role: 'model', referenceUid: 999 }],
        }) });
      providerModel.findAll.mockResolvedValue([profile(10)]);
      await service.update(5, { model_profile_id: 10, enabled: true } as any, 7, 2);
      expect(update).toHaveBeenCalledWith({ model_profile_id: 10, enabled: true });
    });

    it('uses the resultant mode when PATCH changes a realtime agent to cascade', async () => {
      const update = jest.fn();
      agentModel.findOne.mockResolvedValueOnce({
        uid: 5, unique_id: 'sales', update,
        get() { return { uid: 5, unique_id: 'sales', mode: 'realtime', enabled: true, model_profile_id: 10 }; },
      });
      providerModel.findAll.mockResolvedValue([profile(10, 7, ['realtime'])]);
      await expect(service.update(5, { mode: 'cascade' } as any, 7, 1))
        .rejects.toMatchObject({ response: expect.objectContaining({
          issues: expect.arrayContaining([
            { code: 'provider_capability_mismatch', role: 'model', referenceUid: 10 },
            { code: 'missing_provider', role: 'stt', referenceUid: null },
            { code: 'missing_provider', role: 'tts', referenceUid: null },
          ]),
        }) });
      expect(update).not.toHaveBeenCalled();
    });

    it('returns 428 when If-Match revision is missing', async () => {
      agentModel.findOne.mockResolvedValueOnce({
        uid: 5, unique_id: 'sales', update: jest.fn(),
        get() { return { uid: 5, unique_id: 'sales', mode: 'realtime', model_profile_id: 10 }; },
      });
      await expect(service.update(5, { name: 'x' } as any, 7))
        .rejects.toMatchObject({ status: 428 });
    });
  });
});
