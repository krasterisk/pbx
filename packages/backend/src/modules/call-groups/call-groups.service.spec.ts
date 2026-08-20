import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CallGroupsService } from './call-groups.service';
import { DialplanApplyService } from '../ami/dialplan-apply.service';
import { EndpointsService } from '../endpoints/endpoints.service';
import { CreateCallGroupDto } from './dto/call-group.dto';

describe('CallGroupsService', () => {
  let groupModel: any;
  let memberModel: any;
  let sequelize: any;
  let dialplanApplyService: jest.Mocked<Pick<DialplanApplyService, 'applyCategories' | 'deleteCategories'>>;
  let endpointsService: { findAll: jest.Mock; listWebrtcEnabledExtensions: jest.Mock };
  let service: CallGroupsService;
  let transaction: { commit: jest.Mock; rollback: jest.Mock };

  const vpbx = 42;
  const groupRow = (overrides: Record<string, unknown> = {}) => {
    const data = {
      uid: 7,
      name: 'Sales',
      exten: '6007',
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
      query: jest.fn().mockResolvedValue([[]]),
    };
    dialplanApplyService = {
      applyCategories: jest.fn().mockResolvedValue({ success: true, linesApplied: 3 }),
      deleteCategories: jest.fn().mockResolvedValue({ success: true }),
    };
    endpointsService = {
      findAll: jest.fn().mockResolvedValue([{ extension: '101' }, { extension: '102' }]),
      listWebrtcEnabledExtensions: jest.fn().mockResolvedValue(new Set()),
    };
    service = new CallGroupsService(
      groupModel,
      memberModel,
      sequelize,
      dialplanApplyService as unknown as DialplanApplyService,
      endpointsService as unknown as EndpointsService,
    );
  });

  describe('create', () => {
    it('commits a transaction, bulk-creates members, and applies dialplan category', async () => {
      const created = groupRow({ uid: 7, name: 'Sales' });
      groupModel.create.mockResolvedValueOnce(created);
      memberModel.bulkCreate.mockResolvedValueOnce([
        memberRow({ uid: 1, value: '101' }),
      ]);
      groupModel.findOne
        .mockResolvedValueOnce(null) // assertExtenFree
        .mockResolvedValueOnce(created); // findOne return
      memberModel.findAll.mockResolvedValueOnce([memberRow()]);

      const result = await service.create(
        {
          name: 'Sales',
          exten: '6007',
          strategy: 'ringall',
          members: [{ member_type: 'internal', value: '101', position: 0 }],
        } as any,
        vpbx,
      );

      expect(sequelize.transaction).toHaveBeenCalled();
      expect(groupModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Sales', exten: '6007', strategy: 'ringall', user_uid: vpbx }),
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
        [expect.objectContaining({ name: `group_6007_${vpbx}` })],
        { reload: true },
      );
      expect(result.uid).toBe(7);
      expect(result.members).toHaveLength(1);
    });

    it('does not rollback when applyCategories fails after commit; still returns findOne', async () => {
      const created = groupRow({ uid: 7, name: 'Sales' });
      groupModel.create.mockResolvedValueOnce(created);
      memberModel.bulkCreate.mockResolvedValueOnce([memberRow()]);
      dialplanApplyService.applyCategories.mockRejectedValueOnce(
        new Error('File requires escalated privileges'),
      );
      groupModel.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(created);
      memberModel.findAll.mockResolvedValueOnce([memberRow()]);

      const result = await service.create(
        {
          name: 'Sales',
          exten: '6007',
          strategy: 'ringall',
          members: [{ member_type: 'internal', value: '101', position: 0 }],
        } as any,
        vpbx,
      );

      expect(transaction.commit).toHaveBeenCalled();
      expect(transaction.rollback).not.toHaveBeenCalled();
      expect(result.uid).toBe(7);
      expect(result.members).toHaveLength(1);
    });

    it('rejects create without exten', async () => {
      await expect(
        service.create({ name: 'Sales', strategy: 'ringall' } as any, vpbx),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(groupModel.create).not.toHaveBeenCalled();
    });

    it('rejects a duplicate exten in the same tenant with a named conflict', async () => {
      groupModel.findOne.mockResolvedValue(groupRow({ uid: 3, name: 'Other', exten: '6007' }));

      await expect(
        service.create({ name: 'Sales', exten: '6007', strategy: 'ringall' } as any, vpbx),
      ).rejects.toBeInstanceOf(ConflictException);
      await expect(
        service.create({ name: 'Sales', exten: '6007', strategy: 'ringall' } as any, vpbx),
      ).rejects.toThrow(/already used by group "Other"/);
      expect(groupModel.create).not.toHaveBeenCalled();
    });

    it('allows the same exten in another tenant', async () => {
      const created = groupRow({ uid: 8, name: 'Sales', exten: '6007', user_uid: 99 });
      groupModel.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(created);
      groupModel.create.mockResolvedValueOnce(created);
      memberModel.findAll.mockResolvedValueOnce([]);

      await service.create({ name: 'Sales', exten: '6007', strategy: 'ringall' } as any, 99);

      expect(groupModel.findOne).toHaveBeenCalledWith({
        where: { user_uid: 99, exten: '6007' },
      });
      expect(groupModel.create).toHaveBeenCalled();
    });

    it('rolls back when groupModel.create rejects before commit', async () => {
      groupModel.findOne.mockResolvedValueOnce(null);
      groupModel.create.mockRejectedValueOnce(new Error('DB constraint'));

      await expect(
        service.create({ name: 'Sales', exten: '6007', strategy: 'ringall' } as any, vpbx),
      ).rejects.toThrow('DB constraint');

      expect(transaction.commit).not.toHaveBeenCalled();
      expect(transaction.rollback).toHaveBeenCalled();
      expect(dialplanApplyService.applyCategories).not.toHaveBeenCalled();
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
        [expect.objectContaining({ name: `group_6007_${vpbx}` })],
        { reload: true },
      );
    });

    it('does not rollback when applyCategories fails after commit; still returns findOne', async () => {
      const existing = groupRow();
      groupModel.findOne
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(existing);
      memberModel.bulkCreate.mockResolvedValueOnce([
        memberRow({ uid: 2, value: '102', position: 0 }),
      ]);
      dialplanApplyService.applyCategories.mockRejectedValueOnce(new Error('AMI NewCat failed'));
      memberModel.findAll.mockResolvedValueOnce([
        memberRow({ uid: 2, value: '102', position: 0 }),
      ]);

      const result = await service.update(
        7,
        {
          name: 'Sales 2',
          members: [{ member_type: 'internal', value: '102', position: 0 }],
        } as any,
        vpbx,
      );

      expect(transaction.commit).toHaveBeenCalled();
      expect(transaction.rollback).not.toHaveBeenCalled();
      expect(result.uid).toBe(7);
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
        [`group_6007_${vpbx}`, `group_7_${vpbx}`],
        { reload: true },
      );
    });

    it('does not rollback when deleteCategories fails after commit; returns success', async () => {
      const existing = groupRow();
      groupModel.findOne.mockResolvedValueOnce(existing);
      dialplanApplyService.deleteCategories.mockRejectedValueOnce(
        new Error('AMI DelCat failed'),
      );

      const result = await service.remove(7, vpbx);

      expect(transaction.commit).toHaveBeenCalled();
      expect(transaction.rollback).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true });
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

describe('CreateCallGroupDto', () => {
  it('rejects a payload without exten (400)', async () => {
    const dto = plainToInstance(CreateCallGroupDto, { name: 'Sales', strategy: 'ringall' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'exten')).toBe(true);
  });

  it('rejects a non-digit exten', async () => {
    const dto = plainToInstance(CreateCallGroupDto, {
      name: 'Sales',
      strategy: 'ringall',
      exten: 'sales',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'exten')).toBe(true);
  });

  it('accepts a 2-8 digit exten', async () => {
    const dto = plainToInstance(CreateCallGroupDto, {
      name: 'Sales',
      strategy: 'ringall',
      exten: '6007',
    });
    const errors = await validate(dto);
    expect(errors.filter((e) => e.property === 'exten')).toHaveLength(0);
  });
});
