import { AiAgentsService } from './ai-agents.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

/**
 * AI Agents CRUD tests — focus on validation rules:
 *   - cascade requires STT + TTS profile
 *   - all profiles must belong to the tenant or globals (user_uid=0)
 *   - unique_id is unique per tenant
 *   - unique_id only contains [A-Za-z0-9_-]
 */
describe('AiAgentsService', () => {
  let agentModel: any;
  let providerModel: any;
  let toolsetModel: any;
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
    service = new AiAgentsService(agentModel, providerModel, toolsetModel);
  });

  // ─── unique_id validation ───────────────────────────────

  describe('unique_id', () => {
    it('rejects characters outside [A-Za-z0-9_-]', async () => {
      providerModel.findAll.mockResolvedValueOnce([{ uid: 10, user_uid: 7 }]);

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
      providerModel.findAll.mockResolvedValue([{ uid: 10, user_uid: 7 }]);
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
      providerModel.findAll.mockResolvedValue([{ uid: 10, user_uid: 7 }]);
      agentModel.findOne.mockResolvedValueOnce(null); // unique-id check passes

      await expect(
        service.create({
          name: 'Bot',
          unique_id: 'sales',
          mode: 'cascade',
          model_profile_id: 10,
          tts_profile_id: 10,
        } as any, 7),
      ).rejects.toThrow(/cascade.*STT/i);
    });

    it('cascade mode requires TTS profile', async () => {
      providerModel.findAll.mockResolvedValue([{ uid: 10, user_uid: 7 }]);
      agentModel.findOne.mockResolvedValueOnce(null);

      await expect(
        service.create({
          name: 'Bot',
          unique_id: 'sales',
          mode: 'cascade',
          model_profile_id: 10,
          stt_profile_id: 10,
        } as any, 7),
      ).rejects.toThrow(/cascade.*TTS/i);
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
      ).rejects.toThrow(/model profile/i);
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

    it('accepts when provider is global (user_uid = 0)', async () => {
      // Pretend uid 10 is a global template the tenant uses
      providerModel.findAll.mockResolvedValue([{ uid: 10, user_uid: 0 }]);
      agentModel.findOne.mockResolvedValueOnce(null);

      const res = await service.create({
        name: 'Bot',
        unique_id: 'sales',
        mode: 'realtime',
        model_profile_id: 10,
      } as any, 7);

      expect(res).toBeDefined();
      expect(agentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ user_uid: 7, model_profile_id: 10 }),
      );
    });

    it('rejects toolsets owned by another tenant', async () => {
      providerModel.findAll.mockResolvedValue([{ uid: 10, user_uid: 0 }]);
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
      await expect(service.update(5, { name: 'x' } as any, 7))
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
      providerModel.findAll.mockResolvedValue([{ uid: 10, user_uid: 7 }]);

      await service.update(5, { name: 'New name' } as any, 7);

      expect(update).toHaveBeenCalledWith({ name: 'New name' });
    });
  });
});
