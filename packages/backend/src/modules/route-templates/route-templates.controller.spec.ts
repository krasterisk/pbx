import { RouteTemplatesController } from './route-templates.controller';

describe('RouteTemplatesController', () => {
  let service: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
    apply: jest.Mock;
  };
  let controller: RouteTemplatesController;
  const req = { user: { vpbx_user_uid: 100 } };

  beforeEach(() => {
    service = {
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ uid: 1 }),
      create: jest.fn().mockResolvedValue({ uid: 1 }),
      update: jest.fn().mockResolvedValue({ uid: 1 }),
      remove: jest.fn().mockResolvedValue(undefined),
      apply: jest.fn().mockResolvedValue({ actions: [] }),
    };
    controller = new RouteTemplatesController(service as any);
  });

  it('always passes req.user.vpbx_user_uid to CRUD', async () => {
    const body = { name: 'Mine', vpbx_user_uid: 999, actions: [], slots: [] };

    await controller.findAll(req);
    expect(service.findAll).toHaveBeenCalledWith(100);

    await controller.findOne(7, req);
    expect(service.findOne).toHaveBeenCalledWith(7, 100);

    await controller.create(body as any, req);
    expect(service.create).toHaveBeenCalledWith(body, 100);

    await controller.update(7, body as any, req);
    expect(service.update).toHaveBeenCalledWith(7, body, 100);

    await controller.remove(7, req);
    expect(service.remove).toHaveBeenCalledWith(7, 100);

    await controller.apply(7, { slotValues: {}, mode: 'append' }, req);
    expect(service.apply).toHaveBeenCalledWith(7, { slotValues: {}, mode: 'append' }, 100);
  });
});
