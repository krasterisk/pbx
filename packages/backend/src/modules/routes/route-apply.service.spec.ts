import { RouteApplyService } from './route-apply.service';

/**
 * Unit tests for RouteApplyService (D-17, Pitfall 5).
 *
 * Verifies apply order: phonebook binding categories are written BEFORE the
 * route context, with a single final reload — and phonebook-change regen helpers.
 */
describe('RouteApplyService', () => {
  let routesService: any;
  let contextIncludesService: any;
  let dialplanApplyService: any;
  let contextModel: any;
  let bindingModel: any;
  let service: RouteApplyService;

  beforeEach(() => {
    routesService = {
      findAllByContext: jest.fn(),
      generateContextDialplan: jest.fn().mockResolvedValue('[ctx]\nexten => s,1,NoOp()'),
      findOne: jest.fn(),
    };
    contextIncludesService = { getIncludeNames: jest.fn().mockResolvedValue([]) };
    dialplanApplyService = {
      applyCategories: jest.fn().mockResolvedValue({ success: true, linesApplied: 1 }),
    };
    contextModel = { findOne: jest.fn() };
    bindingModel = { findAll: jest.fn() };

    service = new RouteApplyService(
      routesService,
      contextIncludesService,
      dialplanApplyService,
      contextModel,
      bindingModel,
    );
  });

  describe('applyContext', () => {
    it('applies the phonebook binding file BEFORE the route context, with reload only on the final call', async () => {
      contextModel.findOne.mockResolvedValue({ uid: 1, name: 'sip-in', user_uid: 100 });
      routesService.findAllByContext.mockResolvedValue([
        {
          uid: 10,
          bindings: [
            { uid: 42, position: 0, phonebook: { uid: 5, name: 'VIP', entries: [] }, behavior_type: 'vars_only', match_mode: 'on_match' },
          ],
        },
      ]);

      await service.applyContext(1, 100, false);

      expect(dialplanApplyService.applyCategories).toHaveBeenCalledTimes(2);
      const [firstCall, secondCall] = dialplanApplyService.applyCategories.mock.calls;

      expect(firstCall[0]).toBe('krasterisk/phonebooks/pb_100.conf');
      expect(firstCall[1][0].name).toBe('pb_bind_42_100');
      expect(firstCall[2]).toEqual({ reload: false });

      expect(secondCall[0]).toContain('krasterisk/routes/extensions_');
      expect(secondCall[2]).toEqual({ reload: true });
    });

    it('skips the binding-file apply when no route in the context has bindings', async () => {
      contextModel.findOne.mockResolvedValue({ uid: 1, name: 'sip-in', user_uid: 100 });
      routesService.findAllByContext.mockResolvedValue([{ uid: 10, bindings: [] }]);

      await service.applyContext(1, 100, false);

      expect(dialplanApplyService.applyCategories).toHaveBeenCalledTimes(1);
      expect(dialplanApplyService.applyCategories.mock.calls[0][0]).toContain('krasterisk/routes/extensions_');
    });

    it('orders multiple bindings across routes by position ASC within the binding file apply', async () => {
      contextModel.findOne.mockResolvedValue({ uid: 1, name: 'sip-in', user_uid: 100 });
      routesService.findAllByContext.mockResolvedValue([
        {
          uid: 10,
          bindings: [
            { uid: 2, position: 1, phonebook: { uid: 5, name: 'A', entries: [] }, behavior_type: 'vars_only', match_mode: 'on_match' },
            { uid: 1, position: 0, phonebook: { uid: 6, name: 'B', entries: [] }, behavior_type: 'vars_only', match_mode: 'on_match' },
          ],
        },
      ]);

      await service.applyContext(1, 100, false);

      const bindingCategories = dialplanApplyService.applyCategories.mock.calls[0][1];
      expect(bindingCategories.map((c: any) => c.name)).toEqual(['pb_bind_1_100', 'pb_bind_2_100']);
    });

    it('throws NotFoundException when the context does not belong to the tenant', async () => {
      contextModel.findOne.mockResolvedValue(null);
      await expect(service.applyContext(999, 100, false)).rejects.toThrow('Context not found');
    });
  });

  describe('getAffectedContexts / applyContextsForPhonebook', () => {
    it('collects distinct context uids and binding uids for a phonebook', async () => {
      bindingModel.findAll.mockResolvedValue([
        { uid: 1, route_uid: 10 },
        { uid: 2, route_uid: 11 },
      ]);
      routesService.findOne
        .mockResolvedValueOnce({ context_uid: 100 })
        .mockResolvedValueOnce({ context_uid: 101 });

      const result = await service.getAffectedContexts(5, 100);

      expect(result.bindingUids).toEqual([1, 2]);
      expect(result.contextUids).toEqual([100, 101]);
    });

    it('re-applies every distinct context for a phonebook, swallowing individual failures', async () => {
      bindingModel.findAll.mockResolvedValue([{ uid: 1, route_uid: 10 }]);
      routesService.findOne.mockResolvedValue({ context_uid: 100 });
      contextModel.findOne.mockResolvedValue({ uid: 100, name: 'sip-in', user_uid: 100 });
      routesService.findAllByContext.mockResolvedValue([]);

      await expect(service.applyContextsForPhonebook(5, 100, false)).resolves.toBeUndefined();
      expect(dialplanApplyService.applyCategories).toHaveBeenCalledTimes(1);
    });
  });
});
