import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PhonebooksController } from './phonebooks.controller';

/**
 * Unit tests for PhonebooksController.lookupTest (D-10, Pitfall 2).
 *
 * Verifies tenant check happens BEFORE lookupNumber, and the pipe-delimited
 * lookupNumber() result is parsed into { matched, vars }.
 */
describe('PhonebooksController', () => {
  let phonebooksService: any;
  let routeApplyService: any;
  let dialplanApplyService: any;
  let controller: PhonebooksController;

  beforeEach(() => {
    phonebooksService = {
      findOne: jest.fn(),
      lookupNumber: jest.fn(),
      collectAllVarKeys: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    routeApplyService = {
      applyContextsForPhonebook: jest.fn(),
      getAffectedContexts: jest.fn(),
      applyContext: jest.fn(),
    };
    dialplanApplyService = { deleteCategories: jest.fn() };
    controller = new PhonebooksController(phonebooksService, routeApplyService, dialplanApplyService);
  });

  describe('lookupTest', () => {
    it('throws NotFound for a phonebook belonging to another tenant, before calling lookupNumber', async () => {
      phonebooksService.findOne.mockRejectedValue(new NotFoundException('Phonebook not found'));

      await expect(
        controller.lookupTest(99, { number: '79001234567' }, { user: { vpbx_user_uid: 100 } }),
      ).rejects.toThrow(NotFoundException);
      expect(phonebooksService.lookupNumber).not.toHaveBeenCalled();
    });

    it('returns { matched, vars } parsed from the pipe-delimited lookup result for the tenant\'s own phonebook', async () => {
      phonebooksService.findOne.mockResolvedValue({ uid: 5, user_uid: 100 });
      phonebooksService.lookupNumber.mockResolvedValue('1|name|Ivanov|clid|84951110000');

      const result = await controller.lookupTest(5, { number: '79001234567' }, { user: { vpbx_user_uid: 100 } });

      expect(phonebooksService.findOne).toHaveBeenCalledWith(5, 100);
      expect(phonebooksService.lookupNumber).toHaveBeenCalledWith(5, '79001234567');
      expect(result).toEqual({ matched: true, vars: { name: 'Ivanov', clid: '84951110000' } });
    });

    it('returns matched:false with empty vars when no entry matches', async () => {
      phonebooksService.findOne.mockResolvedValue({ uid: 5, user_uid: 100 });
      phonebooksService.lookupNumber.mockResolvedValue('0');

      const result = await controller.lookupTest(5, { number: '000' }, { user: { vpbx_user_uid: 100 } });

      expect(result).toEqual({ matched: false, vars: {} });
    });
  });

  describe('update — var-key change regen trigger (D-18)', () => {
    it('re-applies affected routes when the var-key set changes', async () => {
      phonebooksService.findOne.mockResolvedValueOnce({ entries: [{ vars: { a: '1' } }] });
      phonebooksService.collectAllVarKeys.mockReturnValueOnce(['a']).mockReturnValueOnce(['a', 'b']);
      phonebooksService.update.mockResolvedValue({ entries: [{ vars: { a: '1', b: '2' } }] });

      await controller.update(5, { name: 'X' }, { user: { vpbx_user_uid: 100, level: 0 } });

      expect(routeApplyService.applyContextsForPhonebook).toHaveBeenCalledWith(5, 100, false);
    });

    it('does not trigger regen when the var-key set is unchanged', async () => {
      phonebooksService.findOne.mockResolvedValueOnce({ entries: [{ vars: { a: '1' } }] });
      phonebooksService.collectAllVarKeys.mockReturnValue(['a']);
      phonebooksService.update.mockResolvedValue({ entries: [{ vars: { a: '2' } }] });

      await controller.update(5, { name: 'X' }, { user: { vpbx_user_uid: 100, level: 0 } });

      expect(routeApplyService.applyContextsForPhonebook).not.toHaveBeenCalled();
    });

    it('rejects a sneaked-in invalid actions chain and does not call update', async () => {
      await expect(
        controller.update(5, {
          name: 'X',
          actions: [{ id: 'pb-bad', type: 'toexten', params: { target: { source: 'fixed', value: '' } } }],
        }, { user: { vpbx_user_uid: 100, level: 0 } }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(phonebooksService.update).not.toHaveBeenCalled();
    });
  });

  describe('remove — delete regen + orphaned category cleanup (D-18, Pitfall 5)', () => {
    it('collects affected contexts BEFORE destroy, re-applies them, and DelCats orphaned binding categories', async () => {
      routeApplyService.getAffectedContexts.mockResolvedValue({ contextUids: [1, 2], bindingUids: [42] });

      await controller.remove(5, { user: { vpbx_user_uid: 100, level: 0 } });

      expect(routeApplyService.getAffectedContexts).toHaveBeenCalledWith(5, 100);
      expect(phonebooksService.remove).toHaveBeenCalledWith(5, 100);
      expect(routeApplyService.applyContext).toHaveBeenCalledTimes(2);
      expect(dialplanApplyService.deleteCategories).toHaveBeenCalledWith(
        'krasterisk/phonebooks/pb_100.conf',
        ['pb_bind_42_100'],
        { reload: true },
      );
    });
  });
});
