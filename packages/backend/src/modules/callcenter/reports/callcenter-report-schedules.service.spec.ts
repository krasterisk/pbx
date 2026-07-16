import { NotFoundException } from '@nestjs/common';
import {
  CallCenterReportSchedulesService,
  computeNextRun,
} from './callcenter-report-schedules.service';

describe('CallCenterReportSchedulesService', () => {
  let service: CallCenterReportSchedulesService;
  let model: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
  };
  let notificationsService: { findOne: jest.Mock };

  beforeEach(() => {
    model = {
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((data) => Promise.resolve({ uid: 1, ...data })),
    };
    notificationsService = { findOne: jest.fn().mockResolvedValue({ uid: 10 }) };

    service = new CallCenterReportSchedulesService(
      model as any,
      notificationsService as any,
    );
  });

  it('create rejects foreign integration_uid when findOne throws', async () => {
    notificationsService.findOne.mockRejectedValue(
      new NotFoundException('Notification integration not found'),
    );

    await expect(
      service.create(
        {
          name: 's',
          report_id: 'queue-summary',
          format: 'csv',
          period_preset: 'yesterday',
          frequency: 'daily',
          hour: 8,
          minute: 0,
          integration_uid: 999,
        } as any,
        42,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(model.create).not.toHaveBeenCalled();
  });

  it('CRUD methods filter by user_uid', async () => {
    model.findOne.mockResolvedValue({
      uid: 1,
      user_uid: 42,
      update: jest.fn(),
      destroy: jest.fn(),
      reload: jest.fn().mockResolvedValue({ uid: 1 }),
    });

    await service.findAll(42);
    expect(model.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user_uid: 42 } }),
    );

    await service.findOne(1, 42);
    expect(model.findOne).toHaveBeenCalledWith({ where: { uid: 1, user_uid: 42 } });

    await service.create(
      {
        name: 's',
        report_id: 'queue-summary',
        format: 'xlsx',
        period_preset: 'today',
        frequency: 'daily',
        hour: 9,
        minute: 30,
        integration_uid: 10,
      } as any,
      42,
    );
    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({ user_uid: 42, integration_uid: 10 }),
    );

    await service.remove(1, 42);
    expect(model.findOne).toHaveBeenCalledWith({ where: { uid: 1, user_uid: 42 } });
  });

  it('computeNextRun daily returns future time at hour:minute', () => {
    const from = new Date('2026-07-16T10:00:00');
    const next = computeNextRun(
      { frequency: 'daily', hour: 8, minute: 0 },
      from,
    );
    expect(next.getTime()).toBeGreaterThan(from.getTime());
    expect(next.getHours()).toBe(8);
    expect(next.getMinutes()).toBe(0);
  });

  it('runNow calls delivery.deliverSchedule', async () => {
    const row = { uid: 5, user_uid: 42 };
    model.findOne.mockResolvedValue(row);
    const delivery = {
      deliverSchedule: jest.fn().mockResolvedValue({ success: true }),
    };

    const res = await service.runNow(5, 42, delivery as any);

    expect(delivery.deliverSchedule).toHaveBeenCalledWith(row);
    expect(res).toEqual({ success: true });
  });
});
