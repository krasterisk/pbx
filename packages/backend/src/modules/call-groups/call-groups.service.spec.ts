import { NotFoundException } from '@nestjs/common';
import { CallGroupsService } from './call-groups.service';
import { DialplanApplyService } from '../ami/dialplan-apply.service';

describe('CallGroupsService', () => {
  let groupModel: any;
  let memberModel: any;
  let sequelize: any;
  let dialplanApplyService: jest.Mocked<Pick<DialplanApplyService, 'applyCategories' | 'deleteCategories'>>;
  let service: CallGroupsService;
  let transaction: { commit: jest.Mock; rollback: jest.Mock };

  const vpbx = 42;
  const groupRow = (overrides: Record<string, unknown> = {}) => {
    const data = {
      uid: 7,
      name: 'Sales',
      strategy: 'ringall',
      ring_time: 25,
      external_context: 'from-internal',
      cid_prefix: null,
      user_uid: vpbx,
      ...overrides,
    };
    return {
      ...data,
      toJSON: () => ({ ...data }),
      update: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockResolvedValue(undefined),
    };
  };

  const memberRow = (overrides: Record<string, unknown> = {}) => {
    const data = {
      uid: 1,
      call_group_uid: 7,
      member_type: 'internal',
      value: '101',
      position: 0,
      ring_time: 20,
      user_uid: vpbx,
      ...overrides,
    };
    return {
      ...data,
      toJSON: () => ({ ...data }),
    };
  };

  beforeEach(() => {
    transaction = {
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
    };
    groupModel = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
    };
    memberModel = {
      findAll: jest.fn(),
      bulkCreate: jest.fn(),
      destroy: jest.fn().mockResolvedValue(1),
    };
    sequelize = {
      transaction: jest.fn().mockResolvedValue(transaction),
    };
    dialplanApplyService = {
      applyCategories: jest.fn().mockResolvedValue({ success: true, linesApplied: 3 }),
      deleteCategories: jest.fn().mockResolvedValue({ success: true }),
    };
    service = new CallGroupsService(
      groupModel,
      memberModel,
      sequelize,
      dialplanApplyService as unknown as DialplanApplyService,
    );
  });

  describe('create', () => {
    it('commits a transaction, bulk-creates members, and applies dialplan category', async () => {
      const created = groupRow({ uid: 7, name: 'Sales' });
      groupModel.create.mockResolvedValueOnce(created);
      memberModel.bulkCreate.mockResolvedValueOnce([
        memberRow({ uid: 1, value: '101' }),
      ]);
      // findOne after create
      groupModel.findOne.mockResolvedValueOnce(created);
      memberModel.findAll.mockResolvedValueOnce([memberRow()]);

      const result = await service.create(
        {
          name: 'Sales',
          strategy: 'ringall',
          members: [{ member_type: 'internal', value: '101', position: 0 }],
        } as any,
        vpbx,
      );

      expect(sequelize.transaction).toHaveBeenCalled();
      expect(groupModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Sales', strategy: 'ringall', user_uid: vpbx }),
        { transaction },
      );
      expect(memberModel.bulkCreate).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            member_type: 'internal',
            value: '101',
            position: 0,
            call_group_uid: 7,
            user_uid: vpbx,
          }),
        ],
        { transaction },
      );
      expect(transaction.commit).toHaveBeenCalled();
      expect(dialplanApplyService.applyCategories).toHaveBeenCalledWith(
        `krasterisk/groups/group_${vpbx}.conf`,
        [expect.objectContaining({ name: `group_7_${vpbx}` })],
        { reload: true },
      );
      expect(result.uid).toBe(7);
      expect(result.members).toHaveLength(1);
    });
  });

  describe('update', () => {
    it('replaces members (destroy then bulkCreate) and re-applies dialplan', async () => {
      const existing = groupRow();
      groupModel.findOne
        .mockResolvedValueOnce(existing) // update lookup
        .mockResolvedValueOnce(existing); // findOne return
      memberModel.bulkCreate.mockResolvedValueOnce([
        memberRow({ uid: 2, value: '102', position: 0 }),
      ]);
      memberModel.findAll.mockResolvedValueOnce([
        memberRow({ uid: 2, value: '102', position: 0 }),
      ]);

      await service.update(
        7,
        {
          name: 'Sales 2',
          members: [{ member_type: 'internal', value: '102', position: 0 }],
        } as any,
        vpbx,
      );

      expect(memberModel.destroy).toHaveBeenCalledWith({
        where: { call_group_uid: 7, user_uid: vpbx },
        transaction,
      });
      expect(memberModel.bulkCreate).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            value: '102',
            call_group_uid: 7,
            user_uid: vpbx,
          }),
        ],
        { transaction },
      );
      expect(transaction.commit).toHaveBeenCalled();
      expect(dialplanApplyService.applyCategories).toHaveBeenCalledWith(
        `krasterisk/groups/group_${vpbx}.conf`,
        [expect.objectContaining({ name: `group_7_${vpbx}` })],
        { reload: true },
      );
    });
  });

  describe('remove', () => {
    it('calls deleteCategories with group_<uid>_<vpbx>', async () => {
      const existing = groupRow();
      groupModel.findOne.mockResolvedValueOnce(existing);

      await service.remove(7, vpbx);

      expect(memberModel.destroy).toHaveBeenCalledWith({
        where: { call_group_uid: 7, user_uid: vpbx },
        transaction,
      });
      expect(existing.destroy).toHaveBeenCalledWith({ transaction });
      expect(transaction.commit).toHaveBeenCalled();
      expect(dialplanApplyService.deleteCategories).toHaveBeenCalledWith(
        `krasterisk/groups/group_${vpbx}.conf`,
        [`group_7_${vpbx}`],
        { reload: true },
      );
    });
  });

  describe('findOne / findAll tenant isolation', () => {
    it('filters findAll by user_uid', async () => {
      groupModel.findAll.mockResolvedValueOnce([groupRow()]);
      memberModel.findAll.mockResolvedValueOnce([memberRow()]);

      await service.findAll(vpbx);

      expect(groupModel.findAll).toHaveBeenCalledWith({
        where: { user_uid: vpbx },
        order: [['uid', 'DESC']],
      });
      expect(memberModel.findAll).toHaveBeenCalledWith({
        where: { call_group_uid: 7, user_uid: vpbx },
        order: [['position', 'ASC'], ['uid', 'ASC']],
      });
    });

    it('filters findOne by uid + user_uid', async () => {
      groupModel.findOne.mockResolvedValueOnce(groupRow());
      memberModel.findAll.mockResolvedValueOnce([memberRow()]);

      await service.findOne(7, vpbx);

      expect(groupModel.findOne).toHaveBeenCalledWith({
        where: { uid: 7, user_uid: vpbx },
      });
    });

    it('throws NotFoundException when findOne uid belongs to another tenant', async () => {
      groupModel.findOne.mockResolvedValueOnce(null);

      await expect(service.findOne(99, vpbx)).rejects.toBeInstanceOf(NotFoundException);
      expect(groupModel.findOne).toHaveBeenCalledWith({
        where: { uid: 99, user_uid: vpbx },
      });
    });
  });
});
