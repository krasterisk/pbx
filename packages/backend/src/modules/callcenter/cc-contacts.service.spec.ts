import { NotFoundException } from '@nestjs/common';
import { CallCenterService } from './callcenter.service';
import { CallCenterStateService } from './callcenter-state.service';

/**
 * Focused ownership + tenant isolation tests for softphone cc_contacts (D-13).
 * Constructs CallCenterService with the same stub pattern as callcenter.service.spec.ts.
 */
describe('CallCenterService contacts (D-11…D-15)', () => {
  let service: CallCenterService;

  const ami: any = { isConnected: jest.fn(() => true) };
  const ccAmi: any = {};
  const metricsService: any = {};
  const settingsService: any = {};
  const permissionsService: any = {};
  const loggerService: any = {};
  const emptyModel: any = { findAll: jest.fn().mockResolvedValue([]), findOne: jest.fn(), create: jest.fn() };
  const contactModel: any = {
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    create: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const state = new CallCenterStateService();
    service = new CallCenterService(
      ami,
      state,
      ccAmi,
      metricsService,
      emptyModel,
      emptyModel,
      emptyModel,
      emptyModel,
      emptyModel,
      emptyModel,
      emptyModel,
      emptyModel,
      emptyModel,
      settingsService,
      permissionsService,
      loggerService,
      emptyModel,
      emptyModel,
      emptyModel,
      emptyModel,
      { getPresence: jest.fn() } as any,
      contactModel,
    );
  });

  describe('getMyContacts', () => {
    it('queries only the JWT tenant (never a client-supplied id)', async () => {
      contactModel.findAll.mockResolvedValue([{ uid: 1, name: 'A', number: '100' }]);
      const rows = await service.getMyContacts(7);
      expect(contactModel.findAll).toHaveBeenCalledWith({
        where: { user_uid: 7 },
        order: [['name', 'ASC']],
      });
      expect(rows).toHaveLength(1);
    });
  });

  describe('createContact', () => {
    it('sets user_uid and created_by from JWT, not the DTO', async () => {
      contactModel.create.mockResolvedValue({ uid: 9 });
      await service.createContact({ name: 'Bob', number: '101' }, 7, 42);
      expect(contactModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Bob',
          number: '101',
          user_uid: 7,
          created_by: 42,
        }),
      );
    });
  });

  describe('updateContact / deleteContact ownership (D-13)', () => {
    it('non-supervisor cannot update another operator\'s row (NotFound via where)', async () => {
      contactModel.findOne.mockResolvedValue(null);
      await expect(
        service.updateContact(5, { name: 'X' }, 7, 42, false),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(contactModel.findOne).toHaveBeenCalledWith({
        where: { uid: 5, user_uid: 7, created_by: 42 },
      });
    });

    it('supervisor can update any tenant row (no created_by filter)', async () => {
      const row = { update: jest.fn().mockResolvedValue({ uid: 5, name: 'X' }) };
      contactModel.findOne.mockResolvedValue(row);
      await service.updateContact(5, { name: 'X' }, 7, 99, true);
      expect(contactModel.findOne).toHaveBeenCalledWith({
        where: { uid: 5, user_uid: 7 },
      });
      expect(row.update).toHaveBeenCalledWith({ name: 'X' });
    });

    it('non-supervisor cannot delete another operator\'s row', async () => {
      contactModel.findOne.mockResolvedValue(null);
      await expect(service.deleteContact(5, 7, 42, false)).rejects.toBeInstanceOf(NotFoundException);
      expect(contactModel.findOne).toHaveBeenCalledWith({
        where: { uid: 5, user_uid: 7, created_by: 42 },
      });
    });

    it('supervisor can delete any tenant row', async () => {
      const row = { destroy: jest.fn().mockResolvedValue(undefined) };
      contactModel.findOne.mockResolvedValue(row);
      await expect(service.deleteContact(5, 7, 99, true)).resolves.toEqual({ success: true });
      expect(contactModel.findOne).toHaveBeenCalledWith({
        where: { uid: 5, user_uid: 7 },
      });
      expect(row.destroy).toHaveBeenCalled();
    });

    it('cross-tenant update returns NotFound even for supervisor of another tenant', async () => {
      contactModel.findOne.mockResolvedValue(null);
      await expect(
        service.updateContact(5, { name: 'X' }, 8, 1, true),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(contactModel.findOne).toHaveBeenCalledWith({
        where: { uid: 5, user_uid: 8 },
      });
    });
  });
});
