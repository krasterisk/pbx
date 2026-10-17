import { CallCenterCardsService } from './callcenter-cards.service';

describe('Card queue bindings from UI and AI', () => {
  const findAll = jest.fn();
  const service = new CallCenterCardsService({} as any, {} as any, {} as any, {} as any, {} as any, undefined, { findAll } as any);
  beforeEach(() => findAll.mockResolvedValue([{ name: 'q701_0', display_name: 'Поддержка' }, { name: 'q700_0', display_name: 'Продажи' }]));
  it('normalizes a human name and extension to a stable queue key in the current tenant', async () => {
    expect(await service.normalizeTemplateQueues(['Поддержка', '701', 'q701_0'], 0)).toEqual(['q701_0']);
    expect(findAll).toHaveBeenCalledWith({ where: { user_uid: 0 }, attributes: ['name', 'display_name'] });
  });
  it('rejects unknown, foreign and ambiguous names instead of silently creating an unusable binding', async () => {
    await expect(service.normalizeTemplateQueues(['q701_7'], 0)).rejects.toThrow('unavailable');
    findAll.mockResolvedValue([{ name: 'q701_0', display_name: 'Support' }, { name: 'q702_0', display_name: 'Support' }]);
    await expect(service.normalizeTemplateQueues(['Support'], 0)).rejects.toThrow('ambiguous');
  });
  it('preserves all-queue and omitted bindings', async () => {
    expect(await service.normalizeTemplateQueues([], 0)).toEqual([]);
    expect(await service.normalizeTemplateQueues(undefined, 0)).toBeNull();
  });
});
