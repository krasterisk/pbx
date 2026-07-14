import { RoutesService } from './routes.service';

/**
 * Unit tests for RoutesService bindings CRUD (D-03, D-05, T-05-03).
 *
 * Tests: replace-all bindings strategy on update, tenant ownership validation
 * of phonebook_uid, bindings included + ordered by position ASC on reads.
 */
describe('RoutesService', () => {
  let routeModel: any;
  let bindingModel: any;
  let phonebookModel: any;
  let service: RoutesService;

  beforeEach(() => {
    routeModel = {
      max: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      findOne: jest.fn(),
      findAll: jest.fn(),
      destroy: jest.fn(),
      update: jest.fn(),
    };
    bindingModel = {
      destroy: jest.fn().mockResolvedValue(0),
      bulkCreate: jest.fn().mockResolvedValue([]),
      findAll: jest.fn(),
    };
    phonebookModel = {
      count: jest.fn(),
    };
    service = new RoutesService(routeModel, bindingModel, phonebookModel);
  });

  describe('update — bindings replace-all', () => {
    it('destroys old bindings and bulkCreates new ones scoped to the tenant, positioned by array index', async () => {
      const existingRoute = { uid: 5, context_uid: 1, update: jest.fn().mockResolvedValue(undefined) };
      routeModel.findOne
        .mockResolvedValueOnce(existingRoute) // findOne() inside update() — pre-update fetch
        .mockResolvedValueOnce({ uid: 5, bindings: [] }); // findOne() at the end — post-update refetch
      phonebookModel.count.mockResolvedValueOnce(1);

      const bindings = [{ phonebook_uid: 10, match_mode: 'on_match', behavior_type: 'set_name' }];
      await service.update(5, { name: 'R', bindings } as any, 100);

      expect(bindingModel.destroy).toHaveBeenCalledWith({ where: { route_uid: 5, user_uid: 100 } });
      expect(bindingModel.bulkCreate).toHaveBeenCalledWith([
        expect.objectContaining({
          route_uid: 5,
          phonebook_uid: 10,
          position: 0,
          match_mode: 'on_match',
          behavior_type: 'set_name',
          user_uid: 100,
        }),
      ]);
    });

    it('positions multiple bindings by their array index', async () => {
      const existingRoute = { uid: 5, context_uid: 1, update: jest.fn().mockResolvedValue(undefined) };
      routeModel.findOne
        .mockResolvedValueOnce(existingRoute)
        .mockResolvedValueOnce({ uid: 5, bindings: [] });
      phonebookModel.count.mockResolvedValueOnce(2);

      const bindings = [
        { phonebook_uid: 10, match_mode: 'on_match', behavior_type: 'blacklist' },
        { phonebook_uid: 20, match_mode: 'on_match', behavior_type: 'set_name' },
      ];
      await service.update(5, { bindings } as any, 100);

      const created = bindingModel.bulkCreate.mock.calls[0][0];
      expect(created[0].position).toBe(0);
      expect(created[0].phonebook_uid).toBe(10);
      expect(created[1].position).toBe(1);
      expect(created[1].phonebook_uid).toBe(20);
    });

    it('rejects bindings referencing a phonebook from another tenant, without touching bindingModel', async () => {
      const existingRoute = { uid: 5, context_uid: 1, update: jest.fn() };
      routeModel.findOne.mockResolvedValueOnce(existingRoute);
      phonebookModel.count.mockResolvedValueOnce(0); // owned-count mismatch → foreign phonebook_uid

      const bindings = [{ phonebook_uid: 999, match_mode: 'on_match', behavior_type: 'vars_only' }];
      await expect(service.update(5, { bindings } as any, 100)).rejects.toThrow();
      expect(bindingModel.destroy).not.toHaveBeenCalled();
      expect(bindingModel.bulkCreate).not.toHaveBeenCalled();
    });

    it('leaves bindings untouched when bindings is undefined in the payload', async () => {
      const existingRoute = { uid: 5, context_uid: 1, update: jest.fn().mockResolvedValue(undefined) };
      routeModel.findOne
        .mockResolvedValueOnce(existingRoute)
        .mockResolvedValueOnce({ uid: 5, bindings: [] });

      await service.update(5, { name: 'R only' } as any, 100);

      expect(bindingModel.destroy).not.toHaveBeenCalled();
      expect(bindingModel.bulkCreate).not.toHaveBeenCalled();
    });
  });

  describe('findAll / findAllByContext / findOne — bindings included, ordered by position ASC', () => {
    it('findAll includes the bindings association ordered by position ASC', async () => {
      routeModel.findAll.mockResolvedValue([]);
      await service.findAll(100);

      const callArgs = routeModel.findAll.mock.calls[0][0];
      expect(callArgs.include[0]).toEqual(expect.objectContaining({ as: 'bindings' }));
      expect(callArgs.order).toEqual(
        expect.arrayContaining([[expect.objectContaining({ as: 'bindings' }), 'position', 'ASC']]),
      );
    });

    it('findAllByContext scopes by context_uid + user_uid and includes bindings', async () => {
      routeModel.findAll.mockResolvedValue([]);
      await service.findAllByContext(7, 100);

      const callArgs = routeModel.findAll.mock.calls[0][0];
      expect(callArgs.where).toEqual({ context_uid: 7, user_uid: 100 });
      expect(callArgs.include[0]).toEqual(expect.objectContaining({ as: 'bindings' }));
    });

    it('findOne throws NotFoundException for a route belonging to another tenant', async () => {
      routeModel.findOne.mockResolvedValue(null);
      await expect(service.findOne(5, 999)).rejects.toThrow('Route not found');
    });
  });

  describe('generateRouteDialplan — binding Gosub emission', () => {
    it('emits one Gosub(pb_bind_{uid}_{vpbx}) per binding, ordered by position ASC', () => {
      const route: any = {
        uid: 1,
        name: 'Test route',
        extensions: ['100'],
        actions: [],
        options: {},
        webhooks: {},
        bindings: [
          { uid: 5, position: 1 },
          { uid: 3, position: 0 },
        ],
      };

      const dp = service.generateRouteDialplan(route, 100, false);
      const gosubLines = dp.split('\n').filter((l) => l.includes('Gosub(pb_bind_'));

      expect(gosubLines).toEqual([
        'same => n,Gosub(pb_bind_3_100,s,1)',
        'same => n,Gosub(pb_bind_5_100,s,1)',
      ]);
    });

    it('runs the legacy check_blacklist line only when there are no bindings', () => {
      const routeWithBindings: any = {
        uid: 1, name: 'R', extensions: ['100'], actions: [], webhooks: {},
        options: { check_blacklist: true },
        bindings: [{ uid: 1, position: 0 }],
      };
      const dpWithBindings = service.generateRouteDialplan(routeWithBindings, 100, false);
      expect(dpWithBindings).not.toContain('check_blacklist.php');

      const routeNoBindings: any = {
        uid: 2, name: 'R2', extensions: ['101'], actions: [], webhooks: {},
        options: { check_blacklist: true },
        bindings: [],
      };
      const dpNoBindings = service.generateRouteDialplan(routeNoBindings, 100, false);
      expect(dpNoBindings).toContain('check_blacklist.php');
    });
  });
});
