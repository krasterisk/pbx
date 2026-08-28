import { RouteApplyService } from './route-apply.service';

/**
 * Unit tests for RouteApplyService directory-policy apply order.
 *
 * Policy categories are written to krasterisk/directories/dir_{tenant}.conf
 * BEFORE the route context, with a single final reload.
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
    it('applies the directory policy file BEFORE the route context, with reload only on the final call', async () => {
      contextModel.findOne.mockResolvedValue({ uid: 1, name: 'sip-in', user_uid: 100 });
      routesService.findAllByContext.mockResolvedValue([
        {
          uid: 10,
          bindings: [
            {
              uid: 42,
              position: 0,
              directory_uid: 5,
              key_source: { source: 'original_caller' },
              match_mode: 'on_match',
              behavior_type: 'drop',
              behavior_params: {},
              directory: { uid: 5, name: 'VIP' },
            },
          ],
        },
      ]);

      await service.applyContext(1, 100, false);

      expect(dialplanApplyService.applyCategories).toHaveBeenCalledTimes(2);
      const [firstCall, secondCall] = dialplanApplyService.applyCategories.mock.calls;

      expect(firstCall[0]).toBe('krasterisk/directories/dir_100.conf');
      expect(firstCall[1][0].name).toBe('dir_policy_42_100');
      expect(firstCall[2]).toEqual({ reload: false });
      expect(firstCall[1][0].lines.join('\n')).toContain('/internal/dialplan/directory-lookup?');
      expect(firstCall[1][0].lines.join('\n')).not.toContain('phonebook-lookup');
      expect(firstCall[1][0].lines.join('\n')).not.toContain('PB_');

      expect(secondCall[0]).toContain('krasterisk/routes/extensions_');
      expect(secondCall[2]).toEqual({ reload: true });
    });

    it('skips the policy-file apply when no route in the context has bindings', async () => {
      contextModel.findOne.mockResolvedValue({ uid: 1, name: 'sip-in', user_uid: 100 });
      routesService.findAllByContext.mockResolvedValue([{ uid: 10, bindings: [] }]);

      await service.applyContext(1, 100, false);

      expect(dialplanApplyService.applyCategories).toHaveBeenCalledTimes(1);
      expect(dialplanApplyService.applyCategories.mock.calls[0][0]).toContain('krasterisk/routes/extensions_');
    });

    it('orders multiple policies across routes by position ASC within the policy file apply', async () => {
      contextModel.findOne.mockResolvedValue({ uid: 1, name: 'sip-in', user_uid: 100 });
      routesService.findAllByContext.mockResolvedValue([
        {
          uid: 10,
          bindings: [
            {
              uid: 2,
              position: 1,
              directory_uid: 5,
              key_source: { source: 'original_caller' },
              match_mode: 'on_match',
              behavior_type: 'drop',
              directory: { uid: 5, name: 'A' },
            },
            {
              uid: 1,
              position: 0,
              directory_uid: 6,
              key_source: { source: 'original_caller' },
              match_mode: 'on_match',
              behavior_type: 'drop',
              directory: { uid: 6, name: 'B' },
            },
          ],
        },
      ]);

      await service.applyContext(1, 100, false);

      const bindingCategories = dialplanApplyService.applyCategories.mock.calls[0][1];
      expect(bindingCategories.map((c: any) => c.name)).toEqual(['dir_policy_1_100', 'dir_policy_2_100']);
    });

    it('throws NotFoundException when the context does not belong to the tenant', async () => {
      contextModel.findOne.mockResolvedValue(null);
      await expect(service.applyContext(999, 100, false)).rejects.toThrow('Context not found');
    });
  });
});
