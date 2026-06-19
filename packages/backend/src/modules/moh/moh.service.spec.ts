import { BadRequestException } from '@nestjs/common';
import { MohService } from './moh.service';

describe('MohService', () => {
  const soundsBasePath = '/var/lib/asterisk/sounds/krasterisk';
  let mohClassModel: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    findByPk: jest.Mock;
    create: jest.Mock;
  };
  let mohEntryModel: {
    findAll: jest.Mock;
    destroy: jest.Mock;
    bulkCreate: jest.Mock;
  };
  let amiService: { isConnected: jest.Mock; command: jest.Mock };
  let configService: { get: jest.Mock };
  let service: MohService;

  beforeEach(() => {
    mohClassModel = {
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      findByPk: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        name: 'moh_15_sales',
        mode: 'playlist',
        toJSON: () => ({ name: 'moh_15_sales', mode: 'playlist' }),
      }),
    };
    mohEntryModel = {
      findAll: jest.fn().mockResolvedValue([]),
      destroy: jest.fn().mockResolvedValue(0),
      bulkCreate: jest.fn().mockResolvedValue([]),
    };
    amiService = {
      isConnected: jest.fn().mockReturnValue(false),
      command: jest.fn(),
    };
    configService = {
      get: jest.fn((_key: string, fallback: string) => fallback),
    };

    service = new MohService(
      mohClassModel as any,
      mohEntryModel as any,
      amiService as any,
      configService as any,
    );
  });

  describe('generateClassName', () => {
    it('prefixes with moh_{userUid}_ and slugifies display name', () => {
      expect(service.generateClassName('Sales Hold', 15)).toBe('moh_15_sales_hold');
    });
  });

  describe('create', () => {
    it('rejects empty entries', async () => {
      await expect(
        service.create({ displayName: 'Test', entries: [] }, 15),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates playlist mode class with absolute entry paths', async () => {
      mohClassModel.findByPk.mockResolvedValue(null);
      mohClassModel.findOne.mockResolvedValue({
        name: 'moh_15_sales',
        user_uid: 15,
        toJSON: () => ({ name: 'moh_15_sales', mode: 'playlist' }),
      });
      mohEntryModel.findAll.mockResolvedValue([
        { toJSON: () => ({ name: 'moh_15_sales', position: 1, entry: `${soundsBasePath}/a.wav` }) },
      ]);

      await service.create(
        {
          displayName: 'Sales',
          sort: 'alpha',
          entries: [{ filename: 'a.wav', position: 1 }],
        },
        15,
      );

      expect(mohClassModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'playlist',
          directory: null,
          user_uid: 15,
        }),
      );
      expect(mohEntryModel.bulkCreate).toHaveBeenCalledWith([
        expect.objectContaining({
          entry: `${soundsBasePath}/a.wav`,
          position: 1,
        }),
      ]);
    });
  });

  describe('update', () => {
    it('rejects empty entries replacement', async () => {
      const cls = {
        name: 'moh_15_sales',
        mode: 'files',
        user_uid: 15,
        update: jest.fn(),
        toJSON: () => ({}),
      };
      mohClassModel.findOne.mockResolvedValue(cls);

      await expect(
        service.update('moh_15_sales', { entries: [] }, 15),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
