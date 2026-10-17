import { AutodialAnalyticsService, autodialHourGroup } from './autodial-analytics.service';
describe('Autodial report dimensions', () => {
  it('maps UTC quarter-hour buckets to actual local hours, including DST folds and quarter-hour zones', () => {
    const bucket = (iso: string) => Date.parse(iso) / 900000;
    expect(autodialHourGroup(bucket('2026-10-16T17:30:00Z'), 'Asia/Krasnoyarsk', true)).toBe('6:00');
    expect(autodialHourGroup(bucket('2026-10-16T17:30:00Z'), 'Asia/Kathmandu', false)).toBe('23');
    expect(autodialHourGroup(bucket('2026-11-01T05:30:00Z'), 'America/New_York', false)).toBe('01');
    expect(autodialHourGroup(bucket('2026-11-01T06:30:00Z'), 'America/New_York', false)).toBe('01');
  });
  it('rejects SQL fragments as dimensions and nonnumeric field identities', async () => {
    const query = jest.fn(); const service = new AutodialAnalyticsService({ query } as never, {} as never);
    await expect(service.breakdown(1, { from: '2026-10-01', to: '2026-10-02', dimension: 'DROP TABLE ac_tasks' })).rejects.toMatchObject({ status: 400 });
    await expect(service.breakdown(1, { from: '2026-10-01', to: '2026-10-02', dimension: 'segment', field_uid: '1 OR 1=1' })).rejects.toMatchObject({ status: 400 });
    expect(query).not.toHaveBeenCalled();
  });
});
