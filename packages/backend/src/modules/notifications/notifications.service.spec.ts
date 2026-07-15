import { NotificationsService } from './notifications.service';
import { NotFoundException } from '@nestjs/common';
import * as secretCipher from '../ai-agents/util/secret-cipher.util';

jest.mock('../ai-agents/util/secret-cipher.util', () => ({
  encryptSecret: jest.fn((plain: string) => `enc:${plain}`),
  decryptSecret: jest.fn((blob: string) => blob.replace(/^enc:/, '')),
}));

/**
 * NotificationsService tests — encrypt-on-save, masked reads,
 * tenant-scoped CRUD, and internal decrypt lookup for the dispatcher.
 */
describe('NotificationsService', () => {
  let model: any;
  let service: NotificationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    model = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
    };
    service = new NotificationsService(model);
  });

  describe('create', () => {
    it('encrypts credentials JSON and sets user_uid; never persists plaintext', async () => {
      let persisted: any;
      model.create.mockImplementation((row: any) => {
        persisted = row;
        return Promise.resolve({
          uid: 1,
          toJSON: () => ({ uid: 1, ...row }),
        });
      });

      const result = await service.create({
        name: 'TG Bot',
        channel: 'telegram',
        config: { chat_id: '123' },
        credentials: { bot_token: 'secret-token' },
      } as any, 42);

      expect(persisted.user_uid).toBe(42);
      expect(secretCipher.encryptSecret).toHaveBeenCalledWith(
        JSON.stringify({ bot_token: 'secret-token' }),
      );
      expect(persisted.encrypted_credentials).toBe(
        `enc:${JSON.stringify({ bot_token: 'secret-token' })}`,
      );
      expect(result).not.toHaveProperty('encrypted_credentials');
      expect(result).not.toHaveProperty('credentials');
    });
  });

  describe('findAll / findOne', () => {
    it('strips encrypted_credentials from findAll results', async () => {
      model.findAll.mockResolvedValueOnce([
        {
          toJSON: () => ({
            uid: 1,
            name: 'TG',
            channel: 'telegram',
            config: {},
            encrypted_credentials: 'enc:{"token":"x"}',
            user_uid: 7,
          }),
        },
      ]);

      const rows = await service.findAll(7);
      expect(model.findAll).toHaveBeenCalledWith({
        where: { user_uid: 7 },
        order: [['uid', 'DESC']],
      });
      expect(rows[0]).not.toHaveProperty('encrypted_credentials');
      expect(rows[0].uid).toBe(1);
    });

    it('throws NotFoundException when findOne uid belongs to another tenant', async () => {
      model.findOne.mockResolvedValueOnce(null);
      await expect(service.findOne(99, 7)).rejects.toBeInstanceOf(NotFoundException);
      expect(model.findOne).toHaveBeenCalledWith({ where: { uid: 99, user_uid: 7 } });
    });

    it('strips encrypted_credentials from findOne result', async () => {
      model.findOne.mockResolvedValueOnce({
        toJSON: () => ({
          uid: 2,
          name: 'Email',
          channel: 'email',
          config: {},
          encrypted_credentials: 'enc:{"smtp_pass":"p"}',
          user_uid: 7,
        }),
      });

      const row = await service.findOne(2, 7);
      expect(row).not.toHaveProperty('encrypted_credentials');
    });
  });

  describe('update', () => {
    it('re-encrypts credentials when provided on update', async () => {
      const update = jest.fn().mockResolvedValue(undefined);
      const row = {
        uid: 3,
        encrypted_credentials: 'enc:old',
        update,
        toJSON: () => ({
          uid: 3,
          name: 'Webhook',
          channel: 'webhook',
          config: {},
          encrypted_credentials: 'enc:new',
          user_uid: 7,
        }),
      };
      model.findOne.mockResolvedValueOnce(row);

      await service.update(3, { credentials: { api_key: 'new-key' } } as any, 7);

      expect(secretCipher.encryptSecret).toHaveBeenCalledWith(
        JSON.stringify({ api_key: 'new-key' }),
      );
      const patch = update.mock.calls[0][0];
      expect(patch.encrypted_credentials).toBe(
        `enc:${JSON.stringify({ api_key: 'new-key' })}`,
      );
      expect(patch.credentials).toBeUndefined();
    });
  });

  describe('findByUidInternal', () => {
    it('decrypts credentials without tenant filter (dispatcher lookup)', async () => {
      model.findOne.mockResolvedValueOnce({
        toJSON: () => ({
          uid: 5,
          name: 'VK',
          channel: 'vk',
          config: {},
          encrypted_credentials: `enc:${JSON.stringify({ access_token: 'vk-secret' })}`,
          user_uid: 99,
        }),
      });

      const row = await service.findByUidInternal(5);

      expect(model.findOne).toHaveBeenCalledWith({ where: { uid: 5 } });
      expect(secretCipher.decryptSecret).toHaveBeenCalledWith(
        `enc:${JSON.stringify({ access_token: 'vk-secret' })}`,
      );
      expect(row.credentials).toEqual({ access_token: 'vk-secret' });
    });

    it('throws NotFoundException when integration uid does not exist', async () => {
      model.findOne.mockResolvedValueOnce(null);
      await expect(service.findByUidInternal(404)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
