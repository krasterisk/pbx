import { AiProvidersService } from './ai-providers.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { decryptSecret } from './util/secret-cipher.util';

/**
 * Provider Registry tests — exercise encryption, template cloning,
 * and validation. The Sequelize model is mocked with jest.fn so we
 * assert on the persisted shape rather than reimplementing Op.in.
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
    it('queries with Op.in covering globals and the tenant', async () => {
      model.findAll.mockResolvedValueOnce([]);
      await service.findAll(7);

      expect(model.findAll).toHaveBeenCalled();
      const arg = model.findAll.mock.calls[0][0];
      const opInValues = Object.getOwnPropertySymbols(arg.where.user_uid).map(
        s => arg.where.user_uid[s],
      );
      expect(opInValues[0]).toEqual([0, 7]);
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
        endpoint: 'wss://api.openai.com/v1/realtime',
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
        endpoint: 'http://127.0.0.1:11434',
        capabilities: ['llm'], pricing: { inputTokenUsd: 0 },
      } as any, 7);

      expect(persisted.encrypted_api_key).toBe('');
    });

    it('rejects when capabilities are empty', async () => {
      await expect(
        service.create({
          name: 'X', kind: 'online', vendor: 'x', endpoint: 'wss://x',
          capabilities: [], pricing: {},
        } as any, 7),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when pricing is missing', async () => {
      await expect(
        service.create({
          name: 'X', kind: 'online', vendor: 'x', endpoint: 'wss://x',
          capabilities: ['llm'],
        } as any, 7),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('update', () => {
    it('throws NotFoundException when row is missing or belongs to another tenant (incl. globals)', async () => {
      model.findOne.mockResolvedValueOnce(null);
      await expect(service.update(1, { name: 'changed' } as any, 7))
        .rejects.toBeInstanceOf(NotFoundException);
      // The where clause must scope to the tenant explicitly — globals are not editable
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
      // apiKey shouldn't leak through to model.update
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

  describe('cloneTemplate', () => {
    it('copies the template into the tenant rows, disabled by default and with blank key', async () => {
      model.findOne.mockResolvedValueOnce({
        uid: 5,
        name: 'OpenAI',
        kind: 'online',
        vendor: 'openai',
        endpoint: 'wss://api.openai.com',
        auth_type: 'bearer',
        capabilities: ['llm', 'realtime'],
        defaults: { model: 'x' },
        pricing: { audioMinuteUsd: 0.06 },
      });
      let persisted: any;
      model.create.mockImplementation((row: any) => {
        persisted = row;
        return Promise.resolve({ uid: 99, ...row });
      });

      await service.cloneTemplate(5, 7);

      expect(persisted.user_uid).toBe(7);
      expect(persisted.enabled).toBe(false);
      expect(persisted.encrypted_api_key).toBe('');
      expect(persisted.name).toBe('OpenAI (copy)');
      // Make sure we queried specifically for a global template
      expect(model.findOne).toHaveBeenCalledWith({ where: { uid: 5, user_uid: 0 } });
    });

    it('throws NotFoundException when template uid is not a global row', async () => {
      model.findOne.mockResolvedValueOnce(null);
      await expect(service.cloneTemplate(5, 7))
        .rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
