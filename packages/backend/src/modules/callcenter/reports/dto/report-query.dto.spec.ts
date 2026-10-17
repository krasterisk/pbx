import { ValidationPipe } from '@nestjs/common';
import { ExportReportQueryDto, ReportQueryDto } from './report-query.dto';

describe('report export HTTP query validation', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
  const period = { dateFrom: '2026-10-10', dateTo: '2026-10-16' };

  it.each(['csv', 'xlsx'])('accepts the real export URL parameters for %s', async (format) => {
    await expect(pipe.transform({ ...period, format }, { type: 'query', metatype: ExportReportQueryDto }))
      .resolves.toMatchObject({ ...period, format });
  });

  it('rejects unexpected parameters and unsupported formats without weakening report validation', async () => {
    await expect(pipe.transform({ ...period, format: 'csv', tenantUid: 42 }, { type: 'query', metatype: ExportReportQueryDto })).rejects.toThrow();
    await expect(pipe.transform({ ...period, format: 'exe' }, { type: 'query', metatype: ExportReportQueryDto })).rejects.toThrow();
    await expect(pipe.transform({ ...period, format: 'csv' }, { type: 'query', metatype: ReportQueryDto })).rejects.toThrow();
  });
});
