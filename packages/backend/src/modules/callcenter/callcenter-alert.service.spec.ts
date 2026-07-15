import { NotFoundException } from '@nestjs/common';
import {
  CallCenterAlertService,
  ALERT_EVAL_INTERVAL_MS,
} from './callcenter-alert.service';
import { CallCenterWallboardService } from './callcenter-wallboard.service';

describe('CallCenterAlertService', () => {
  let service: CallCenterAlertService;
  let alertConfigModel: { findAll: jest.Mock };
  let metricsService: { getTenantQueueMetrics: jest.Mock };
  let settingsService: { getTenantSettings: jest.Mock };
  let stateService: { getSnapshot: jest.Mock };
  let dispatcherService: { dispatch: jest.Mock };

  beforeEach(() => {
    alertConfigModel = { findAll: jest.fn().mockResolvedValue([]) };
    metricsService = { getTenantQueueMetrics: jest.fn().mockReturnValue([]) };
    settingsService = {
      getTenantSettings: jest.fn().mockResolvedValue({
        alert_thresholds: {
          max_wait_sec: 60,
          abandon_rate_pct: 10,
          sla_critical_pct: 80,
          agents_available_min: 1,
        },
      }),
    };
    stateService = {
      getSnapshot: jest.fn().mockReturnValue({
        queues: [{ agents: { available: 5 } }],
        calls: [],
      }),
    };
    dispatcherService = { dispatch: jest.fn().mockResolvedValue(undefined) };

    service = new CallCenterAlertService(
      alertConfigModel as any,
      metricsService as any,
      settingsService as any,
      stateService as any,
      dispatcherService as any,
    );
    service.clearCooldown();
  });

  it('exports ALERT_EVAL_INTERVAL_MS', () => {
    expect(ALERT_EVAL_INTERVAL_MS).toBe(30_000);
  });

  it('dispatches on SLA breach when alert-config enabled', async () => {
    alertConfigModel.findAll.mockResolvedValue([
      {
        user_uid: 7,
        integration_uid: 42,
        target: 'chat-1',
        enabled: true,
        cooldown_sec: 300,
      },
    ]);
    metricsService.getTenantQueueMetrics.mockReturnValue([
      { queueName: 'sales', sla: 62, abandonRate: 2 },
    ]);

    await service.evaluate();

    expect(dispatcherService.dispatch).toHaveBeenCalledTimes(1);
    expect(dispatcherService.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        integration_uid: 42,
        target: 'chat-1',
        message: expect.stringContaining('sales'),
      }),
    );
  });

  it('suppresses duplicate dispatch within cooldown, fires after window', async () => {
    alertConfigModel.findAll.mockResolvedValue([
      {
        user_uid: 7,
        integration_uid: 42,
        target: 'chat-1',
        enabled: true,
        cooldown_sec: 300,
      },
    ]);
    metricsService.getTenantQueueMetrics.mockReturnValue([
      { queueName: 'sales', sla: 50, abandonRate: 0 },
    ]);

    await service.evaluate();
    expect(dispatcherService.dispatch).toHaveBeenCalledTimes(1);

    await service.evaluate();
    expect(dispatcherService.dispatch).toHaveBeenCalledTimes(1); // cooldown

    // Simulate cooldown expiry
    (service as any).lastFired.set('7:sla', Date.now() - 301_000);
    await service.evaluate();
    expect(dispatcherService.dispatch).toHaveBeenCalledTimes(2);
  });

  it('skips tenants with enabled:false (not returned by findAll filter)', async () => {
    alertConfigModel.findAll.mockResolvedValue([]); // only enabled:true queried

    await service.evaluate();

    expect(settingsService.getTenantSettings).not.toHaveBeenCalled();
    expect(dispatcherService.dispatch).not.toHaveBeenCalled();
    expect(alertConfigModel.findAll).toHaveBeenCalledWith({
      where: { enabled: true },
    });
  });
});

describe('CallCenterWallboardService updateAlertConfig cross-tenant', () => {
  it('rejects foreign integration_uid via notificationsService.findOne', async () => {
    const displayTokenModel = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
    };
    const alertConfigModel = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
    };
    const notificationsService = {
      findOne: jest.fn().mockRejectedValue(new NotFoundException()),
    };
    const wallboard = new CallCenterWallboardService(
      displayTokenModel as any,
      alertConfigModel as any,
      notificationsService as any,
    );

    await expect(
      wallboard.updateAlertConfig(1, { integration_uid: 99 }),
    ).rejects.toThrow(NotFoundException);
    expect(notificationsService.findOne).toHaveBeenCalledWith(99, 1);
  });
});
