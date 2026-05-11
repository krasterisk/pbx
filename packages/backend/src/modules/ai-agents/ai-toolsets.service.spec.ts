import { AiToolsetsService } from './ai-toolsets.service';
import { NotFoundException } from '@nestjs/common';

describe('AiToolsetsService', () => {
  let model: any;
  let service: AiToolsetsService;

  beforeEach(() => {
    model = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((row: any) => Promise.resolve({ uid: 1, ...row })),
    };
    service = new AiToolsetsService(model);
  });

  it('scopes findAll to the tenant only (no globals here)', async () => {
    await service.findAll(7);
    expect(model.findAll).toHaveBeenCalledWith({
      where: { user_uid: 7 },
      order: [['name', 'ASC']],
    });
  });

  it('throws NotFoundException for a cross-tenant uid', async () => {
    model.findOne.mockResolvedValueOnce(null);
    await expect(service.findOne(5, 7)).rejects.toBeInstanceOf(NotFoundException);
    expect(model.findOne).toHaveBeenCalledWith({ where: { uid: 5, user_uid: 7 } });
  });

  it('persists tools as an array, defaulting to []', async () => {
    await service.create({ name: 'CRM' } as any, 7);
    expect(model.create).toHaveBeenCalledWith({
      name: 'CRM',
      description: '',
      tools: [],
      user_uid: 7,
    });
  });

  it('update reuses findOne to enforce tenancy then patches the row', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    model.findOne.mockResolvedValueOnce({ uid: 5, update });
    await service.update(5, { name: 'New' } as any, 7);
    expect(update).toHaveBeenCalledWith({ name: 'New' });
  });
});
