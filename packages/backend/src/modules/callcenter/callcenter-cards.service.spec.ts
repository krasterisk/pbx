import { CallCenterCardsService } from './callcenter-cards.service';

describe('CallCenterCardsService webhook dispatch', () => {
  let service: CallCenterCardsService;
  let templateModel: {
    findOne: jest.Mock;
    findAll: jest.Mock;
    create: jest.Mock;
  };
  let fieldModel: {
    findAll: jest.Mock;
    destroy: jest.Mock;
    bulkCreate: jest.Mock;
  };
  let cardDataModel: {
    findOne: jest.Mock;
    findAll: jest.Mock;
    create: jest.Mock;
  };
  let notificationsService: {
    findByUidInternal: jest.Mock;
  };
  let webhook: {
    send: jest.Mock;
  };

  const vpbx = 7;
  const agentId = 42;

  beforeEach(() => {
    templateModel = {
      findOne: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
    };
    fieldModel = {
      findAll: jest.fn().mockResolvedValue([]),
      destroy: jest.fn(),
      bulkCreate: jest.fn(),
    };
    cardDataModel = {
      findOne: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
    };
    notificationsService = {
      findByUidInternal: jest.fn(),
    };
    webhook = {
      send: jest.fn().mockResolvedValue({ success: true }),
    };

    service = new CallCenterCardsService(
      templateModel as any,
      fieldModel as any,
      cardDataModel as any,
      notificationsService as any,
      webhook as any,
    );
  });

  describe('saveCard', () => {
    it('does NOT call webhook.send when template has no webhook_integration_uid', async () => {
      templateModel.findOne.mockResolvedValue({
        uid: 1,
        user_uid: vpbx,
        webhook_integration_uid: null,
      });
      cardDataModel.create.mockResolvedValue({
        uid: 100,
        field_values: { name: 'Bob' },
        caller_id: '',
        queue_name: '',
        call_uniqueid: '',
      });

      await service.saveCard(
        { template_id: 1, field_values: { name: 'Bob' } },
        vpbx,
        agentId,
      );

      expect(webhook.send).not.toHaveBeenCalled();
      expect(notificationsService.findByUidInternal).not.toHaveBeenCalled();
    });

    it('calls webhook.send with extraVars from field_values for own tenant', async () => {
      templateModel.findOne.mockResolvedValue({
        uid: 1,
        user_uid: vpbx,
        webhook_integration_uid: 55,
        webhook_field_map: null,
      });
      cardDataModel.create.mockResolvedValue({
        uid: 100,
        field_values: { customer_name: 'Alice', age: 30 },
        caller_id: '1001',
        queue_name: 'sales',
        call_uniqueid: 'abc.123',
      });
      notificationsService.findByUidInternal.mockResolvedValue({
        uid: 55,
        user_uid: vpbx,
        channel: 'webhook',
      });

      await service.saveCard(
        {
          template_id: 1,
          field_values: { customer_name: 'Alice', age: 30 },
          caller_id: '1001',
          queue_name: 'sales',
          call_uniqueid: 'abc.123',
        },
        vpbx,
        agentId,
      );

      expect(webhook.send).toHaveBeenCalledWith(
        expect.objectContaining({ uid: 55, channel: 'webhook' }),
        undefined,
        '',
        expect.objectContaining({
          customer_name: 'Alice',
          age: '30',
          caller_id: '1001',
          queue_name: 'sales',
          call_uniqueid: 'abc.123',
        }),
      );
    });

    it('does NOT call webhook.send when integration belongs to another tenant', async () => {
      templateModel.findOne.mockResolvedValue({
        uid: 1,
        user_uid: vpbx,
        webhook_integration_uid: 99,
      });
      cardDataModel.create.mockResolvedValue({
        uid: 100,
        field_values: { x: 'y' },
        caller_id: '',
        queue_name: '',
        call_uniqueid: '',
      });
      notificationsService.findByUidInternal.mockResolvedValue({
        uid: 99,
        user_uid: 888,
        channel: 'webhook',
      });

      await service.saveCard(
        { template_id: 1, field_values: { x: 'y' } },
        vpbx,
        agentId,
      );

      expect(webhook.send).not.toHaveBeenCalled();
    });

    it('does not throw when webhook.send rejects', async () => {
      templateModel.findOne.mockResolvedValue({
        uid: 1,
        user_uid: vpbx,
        webhook_integration_uid: 55,
      });
      cardDataModel.create.mockResolvedValue({
        uid: 100,
        field_values: {},
        caller_id: '',
        queue_name: '',
        call_uniqueid: '',
      });
      notificationsService.findByUidInternal.mockResolvedValue({
        uid: 55,
        user_uid: vpbx,
        channel: 'webhook',
      });
      webhook.send.mockRejectedValue(new Error('network down'));

      await expect(
        service.saveCard({ template_id: 1, field_values: {} }, vpbx, agentId),
      ).resolves.toBeDefined();

      expect(cardDataModel.create).toHaveBeenCalled();
    });
  });
});
