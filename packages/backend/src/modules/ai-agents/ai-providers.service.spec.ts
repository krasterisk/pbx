import { AiProvidersService } from './ai-providers.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { decryptSecret } from './util/secret-cipher.util';

/**
 * Tenant-owned provider registry — encryption, tenant scoping, and
 * chat-completions default resolution. No global templates.
 */
describe('AiProvidersService', () => {
  let model: any;
  let service: AiProvidersService;

  beforeEach(() => {
    model = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
    };
    service = new AiProvidersService(model);
  });

  describe('findAll', () => {
    it('lists only the calling tenant rows', async () => {
      model.findAll.mockResolvedValueOnce([]);
      await service.findAll(7);

      expect(model.findAll).toHaveBeenCalledWith({
        where: { user_uid: 7 },
        order: [['name', 'ASC']],
      });
    });
  });

  describe('create', () => {
    it('encrypts the apiKey, defaults auth_type to bearer, marks enabled', async () => {
      let persisted: any;
      model.create.mockImplementation((row: any) => {
        persisted = row;
        return Promise.resolve({ uid: 1, ...row });
      });

      await service.create({
        name: 'OpenAI',
        kind: 'online',
        vendor: 'openai',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        capabilities: ['llm', 'realtime'],
        pricing: { audioMinuteUsd: 0.06 },
        apiKey: 'sk-secret',
      } as any, 7);

      expect(persisted.user_uid).toBe(7);
      expect(persisted.auth_type).toBe('bearer');
      expect(persisted.enabled).toBe(true);
      expect(persisted.encrypted_api_key).not.toBe('sk-secret');
      expect(decryptSecret(persisted.encrypted_api_key)).toBe('sk-secret');
    });

    it('stores empty string when no apiKey is provided (e.g. local providers)', async () => {
      let persisted: any;
      model.create.mockImplementation((row: any) => {
        persisted = row;
        return Promise.resolve({ uid: 1, ...row });
      });

      await service.create({
        name: 'Ollama', kind: 'local', vendor: 'ollama',
        endpoint: 'http://127.0.0.1:11434/v1/chat/completions',
        capabilities: ['llm'], pricing: { inputTokenUsd: 0 },
      } as any, 7);

      expect(persisted.encrypted_api_key).toBe('');
    });

    it('rejects when capabilities are empty', async () => {
      await expect(
        service.create({
          name: 'X', kind: 'online', vendor: 'x', endpoint: 'https://x',
          capabilities: [], pricing: {},
        } as any, 7),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when pricing is missing', async () => {
      await expect(
        service.create({
          name: 'X', kind: 'online', vendor: 'x', endpoint: 'https://x',
          capabilities: ['llm'],
        } as any, 7),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('update', () => {
    it('throws NotFoundException when row is missing or belongs to another tenant', async () => {
      model.findOne.mockResolvedValueOnce(null);
      await expect(service.update(1, { name: 'changed' } as any, 7))
        .rejects.toBeInstanceOf(NotFoundException);
      expect(model.findOne).toHaveBeenCalledWith({ where: { uid: 1, user_uid: 7 } });
    });

    it('re-encrypts apiKey when provided', async () => {
      const update = jest.fn().mockResolvedValue(undefined);
      const row = { uid: 1, encrypted_api_key: 'old-enc', update } as any;
      model.findOne.mockResolvedValueOnce(row);

      await service.update(1, { apiKey: 'sk-new' } as any, 7);
      const patch = update.mock.calls[0][0];
      expect(patch.encrypted_api_key).toBeDefined();
      expect(decryptSecret(patch.encrypted_api_key)).toBe('sk-new');
      expect(patch.apiKey).toBeUndefined();
    });

    it('clears encrypted_api_key when apiKey is empty string', async () => {
      const update = jest.fn().mockResolvedValue(undefined);
      const row = { uid: 1, encrypted_api_key: 'old-enc', update } as any;
      model.findOne.mockResolvedValueOnce(row);

      await service.update(1, { apiKey: '' } as any, 7);
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ encrypted_api_key: '' }),
      );
    });
  });

  describe('findDefaultLlm', () => {
    const tenantLlm = {
      uid: 11,
      name: 'Tenant LLM',
      enabled: true,
      user_uid: 7,
      capabilities: ['llm'],
      endpoint: 'https://api.openai.com/v1/chat/completions',
    };
    const otherTenantLlm = {
      uid: 99,
      name: 'Other tenant',
      enabled: true,
      user_uid: 8,
      capabilities: ['llm'],
      endpoint: 'https://api.openai.com/v1/chat/completions',
    };
    const sttOnly = {
      uid: 3,
      name: 'STT',
      enabled: true,
      user_uid: 7,
      capabilities: ['stt'],
      endpoint: 'https://stt.example/recognize',
    };
    const realtimeOnly = {
      uid: 2,
      name: 'Custom WebSocket',
      enabled: true,
      user_uid: 7,
      capabilities: ['llm', 'realtime'],
      endpoint: 'wss://example.com/voice-ai/realtime',
    };

    it('honours a preferred provider that belongs to the tenant and is a chat LLM', async () => {
      model.findOne.mockResolvedValueOnce(tenantLlm);

      await expect(service.findDefaultLlm(7, 11)).resolves.toEqual(tenantLlm);
      expect(model.findOne).toHaveBeenCalledWith({
        where: { uid: 11, user_uid: 7, enabled: true },
      });
      expect(model.findAll).not.toHaveBeenCalled();
    });

    it('falls back to the first enabled chat LLM owned by the tenant', async () => {
      model.findAll.mockResolvedValueOnce([tenantLlm, otherTenantLlm, sttOnly]);

      await expect(service.findDefaultLlm(7)).resolves.toEqual(tenantLlm);
      expect(model.findAll).toHaveBeenCalledWith({
        where: { user_uid: 7, enabled: true },
        order: [['uid', 'ASC']],
      });
    });

    it('skips a preferred row that is not a chat-completions LLM', async () => {
      model.findOne.mockResolvedValueOnce(sttOnly);
      model.findAll.mockResolvedValueOnce([tenantLlm]);

      await expect(service.findDefaultLlm(7, 3)).resolves.toEqual(tenantLlm);
    });

    it('skips a language-model row whose endpoint cannot become a chat-completions URL', async () => {
      model.findAll.mockResolvedValueOnce([realtimeOnly, tenantLlm]);

      await expect(service.findDefaultLlm(7)).resolves.toEqual(tenantLlm);
    });

    it('caches the resolved row per tenant for sixty seconds', async () => {
      jest.useFakeTimers();
      model.findAll.mockResolvedValue([tenantLlm]);

      await service.findDefaultLlm(7);
      await service.findDefaultLlm(7);
      expect(model.findAll).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(60_000);
      await service.findDefaultLlm(7);
      expect(model.findAll).toHaveBeenCalledTimes(2);
      jest.useRealTimers();
    });
  });
});
