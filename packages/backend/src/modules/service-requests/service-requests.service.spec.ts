import { Op } from 'sequelize';
import {
  buildCallReceivedAtRange,
  normalizeQueryFilterValues,
  parseCsvFilter,
  ServiceRequestsService,
} from './service-requests.service';

describe('buildCallReceivedAtRange', () => {
  it('builds inclusive datetime boundaries for YYYY-MM-DD params', () => {
    const range = buildCallReceivedAtRange('2026-05-25', '2026-05-26');

    expect(range).not.toBeNull();
    expect(range![Op.gte]).toBe('2026-05-25 00:00:00');
    expect(range![Op.lte]).toBe('2026-05-26 23:59:59');
  });

  it('returns null when params are missing or invalid', () => {
    expect(buildCallReceivedAtRange(undefined, undefined)).toBeNull();
    expect(buildCallReceivedAtRange('invalid', 'also-invalid')).toBeNull();
  });

  it('accepts a valid dateTo even if dateFrom is invalid', () => {
    const range = buildCallReceivedAtRange('invalid', '2026-05-26');
    expect(range).not.toBeNull();
    expect(range![Op.lte]).toBe('2026-05-26 23:59:59');
    expect(range![Op.gte]).toBeUndefined();
  });
});

describe('normalizeQueryFilterValues', () => {
  it('keeps values with commas intact', () => {
    expect(normalizeQueryFilterValues(['Запрос (Акт сверки, Счета)'])).toEqual([
      'Запрос (Акт сверки, Счета)',
    ]);
  });

  it('normalizes repeated query params', () => {
    expect(normalizeQueryFilterValues(['КГО', 'РСО'])).toEqual(['КГО', 'РСО']);
  });

  it('treats a single string as one value', () => {
    expect(normalizeQueryFilterValues('Запрос (Акт сверки, Счета)')).toEqual([
      'Запрос (Акт сверки, Счета)',
    ]);
  });

  it('returns undefined for empty values', () => {
    expect(normalizeQueryFilterValues(undefined)).toBeUndefined();
    expect(normalizeQueryFilterValues([])).toBeUndefined();
    expect(normalizeQueryFilterValues(['', '  '])).toBeUndefined();
  });
});

describe('parseCsvFilter', () => {
  it('splits comma-separated values and trims whitespace', () => {
    expect(parseCsvFilter('КГО, РСО')).toEqual(['КГО', 'РСО']);
  });

  it('returns undefined for empty or missing values', () => {
    expect(parseCsvFilter(undefined)).toBeUndefined();
    expect(parseCsvFilter('')).toBeUndefined();
    expect(parseCsvFilter(' , ')).toBeUndefined();
  });
});

describe('ServiceRequestsService.findAll', () => {
  let findAndCountAll: jest.Mock;
  let service: ServiceRequestsService;

  beforeEach(() => {
    findAndCountAll = jest.fn().mockResolvedValue({ rows: [], count: 0 });
    service = new ServiceRequestsService({ findAndCountAll } as any, {} as any);
  });

  it('applies call_received_at range when dateFrom and dateTo are provided', async () => {
    await service.findAll(1, {
      dateFrom: '2026-05-25',
      dateTo: '2026-05-26',
      limit: 30,
      offset: 0,
    });

    expect(findAndCountAll).toHaveBeenCalledTimes(1);
    const where = findAndCountAll.mock.calls[0][0].where;

    expect(where.user_uid).toBe(1);
    expect(where.call_received_at[Op.gte]).toBe('2026-05-25 00:00:00');
    expect(where.call_received_at[Op.lte]).toBe('2026-05-26 23:59:59');
  });

  it('combines date filter with search filter', async () => {
    await service.findAll(1, {
      dateFrom: '2026-05-25',
      dateTo: '2026-05-26',
      search: 'test',
    });

    const where = findAndCountAll.mock.calls[0][0].where;
    expect(where.call_received_at).toBeDefined();
    expect(where[Op.or]).toBeDefined();
  });

  it('applies Op.in for multi-value topic filter', async () => {
    await service.findAll(1, { topic: ['КГО', 'РСО'] });

    const where = findAndCountAll.mock.calls[0][0].where;
    expect(where.topic[Op.in]).toEqual(['КГО', 'РСО']);
  });

  it('keeps topic values with commas as a single filter value', async () => {
    await service.findAll(1, { topic: ['Запрос (Акт сверки, Счета)'] });

    const where = findAndCountAll.mock.calls[0][0].where;
    expect(where.topic).toBe('Запрос (Акт сверки, Счета)');
  });

  it('applies Op.in for multi-value status filter', async () => {
    await service.findAll(1, { status: ['new', 'in_progress'] });

    const where = findAndCountAll.mock.calls[0][0].where;
    expect(where.request_status[Op.in]).toEqual(['new', 'in_progress']);
  });
});
