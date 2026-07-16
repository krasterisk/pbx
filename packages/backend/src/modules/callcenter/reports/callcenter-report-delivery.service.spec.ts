import { CallCenterReportDeliveryService } from './callcenter-report-delivery.service';
import * as xlsxExporter from './exporters/xlsx-exporter';
import * as csvExporter from './exporters/csv-exporter';

describe('CallCenterReportDeliveryService', () => {
  let service: CallCenterReportDeliveryService;
  let reportsService: { runReport: jest.Mock };
  let notificationsService: { findByUidInternal: jest.Mock };
  let dispatcherService: { dispatch: jest.Mock };
  let mailerService: { sendReportMail: jest.Mock };

  const baseSchedule = {
    uid: 1,
    name: 'Daily queue',
    report_id: 'queue-summary',
    format: 'xlsx' as const,
    period_preset: 'yesterday' as const,
    filters: null,
    frequency: 'daily' as const,
    hour: 8,
    minute: 0,
    day_of_week: null,
    day_of_month: null,
    integration_uid: 10,
    target: 'boss@example.com',
    subject_template: null,
    message_template: null,
    enabled: true,
    last_run_at: null,
    last_status: null,
    last_error: null,
    next_run_at: null,
    user_uid: 42,
  };

  beforeEach(() => {
    reportsService = { runReport: jest.fn() };
    notificationsService = { findByUidInternal: jest.fn() };
    dispatcherService = { dispatch: jest.fn().mockResolvedValue(undefined) };
    mailerService = { sendReportMail: jest.fn().mockResolvedValue({ success: true }) };

    service = new CallCenterReportDeliveryService(
      reportsService as any,
      notificationsService as any,
      dispatcherService as any,
      mailerService as any,
    );

    jest.spyOn(xlsxExporter, 'buildReportXlsx').mockResolvedValue(Buffer.from('xlsx'));
    jest.spyOn(csvExporter, 'buildReportCsv').mockReturnValue('csv;data');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects delivery when integration.user_uid !== schedule.user_uid', async () => {
    notificationsService.findByUidInternal.mockResolvedValue({
      uid: 10,
      channel: 'email',
      user_uid: 99,
      config: { to: 'x@y.com' },
    });

    const res = await service.deliverSchedule(baseSchedule as any);

    expect(res).toEqual({ success: false, error: 'integration_tenant_mismatch' });
    expect(reportsService.runReport).not.toHaveBeenCalled();
    expect(mailerService.sendReportMail).not.toHaveBeenCalled();
  });

  it('calls runReport with schedule.user_uid (tenant-scoped)', async () => {
    notificationsService.findByUidInternal.mockResolvedValue({
      uid: 10,
      channel: 'email',
      user_uid: 42,
      config: { to: 'boss@example.com' },
    });
    reportsService.runReport.mockResolvedValue({
      reportId: 'queue-summary',
      columns: [{ key: 'a', header: 'A' }],
      rows: [{ a: 1 }],
    });

    await service.deliverSchedule(baseSchedule as any);

    expect(reportsService.runReport).toHaveBeenCalledWith(
      'queue-summary',
      42,
      expect.objectContaining({
        dateFrom: expect.any(String),
        dateTo: expect.any(String),
      }),
    );
  });

  it('email + xlsx calls buildReportXlsx and sendReportMail with attachment', async () => {
    notificationsService.findByUidInternal.mockResolvedValue({
      uid: 10,
      channel: 'email',
      user_uid: 42,
      config: {},
    });
    reportsService.runReport.mockResolvedValue({
      reportId: 'queue-summary',
      columns: [{ key: 'a', header: 'A' }],
      rows: [{ a: 1 }],
    });

    const res = await service.deliverSchedule(baseSchedule as any);

    expect(res.success).toBe(true);
    expect(xlsxExporter.buildReportXlsx).toHaveBeenCalled();
    expect(mailerService.sendReportMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'boss@example.com',
        attachment: expect.objectContaining({
          filename: expect.stringMatching(/\.xlsx$/),
          contentType: expect.stringContaining('spreadsheetml'),
        }),
      }),
    );
    expect(dispatcherService.dispatch).not.toHaveBeenCalled();
  });

  it('messenger channel dispatches text summary (not mailer)', async () => {
    notificationsService.findByUidInternal.mockResolvedValue({
      uid: 10,
      channel: 'telegram',
      user_uid: 42,
      config: {},
    });
    reportsService.runReport.mockResolvedValue({
      reportId: 'queue-summary',
      columns: [{ key: 'a', header: 'A' }],
      rows: [{ a: 1 }],
    });

    const res = await service.deliverSchedule({
      ...baseSchedule,
      target: '12345',
      format: 'csv',
    } as any);

    expect(res.success).toBe(true);
    expect(mailerService.sendReportMail).not.toHaveBeenCalled();
    expect(dispatcherService.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        integration_uid: 10,
        message: expect.stringContaining('queue-summary'),
        target: '12345',
      }),
    );
  });

  it('resolvePeriod(yesterday) returns a one-day window with dateFrom <= dateTo', () => {
    const fixed = new Date('2026-07-16T12:00:00.000Z');
    const { dateFrom, dateTo } = service.resolvePeriod('yesterday', fixed);
    expect(dateFrom <= dateTo).toBe(true);
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    const durationMs = to.getTime() - from.getTime();
    // Local calendar day → ISO; allow ~24h (± timezone/DST edge)
    expect(durationMs).toBeLessThanOrEqual(24 * 60 * 60 * 1000 + 1000);
    expect(durationMs).toBeGreaterThan(0);
    // Yesterday is strictly before the fixed "today" calendar day (local)
    const todayStart = new Date(fixed);
    todayStart.setHours(0, 0, 0, 0);
    expect(to.getTime()).toBeLessThanOrEqual(todayStart.getTime());
  });
});
