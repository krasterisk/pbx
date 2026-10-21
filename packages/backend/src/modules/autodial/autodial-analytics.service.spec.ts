import { AutodialAnalyticsService, autodialHourGroup } from './autodial-analytics.service';
describe('Autodial report dimensions', () => {
  it.each(['mysql', 'postgres'])('keeps short business achievements and unknown legacy outcomes in %s', async (dialect) => {
    const query = jest.fn().mockResolvedValue([{ value: 'achieved', dials: '1', answered: '1', success: '0', talk_sec: '13', contacts: '1' }]);
    const service = new AutodialAnalyticsService({ query, getDialect: () => dialect } as never,
      { reportWindow: async () => ({ from: new Date('2026-10-18T00:00:00Z'), to: new Date('2026-10-19T00:00:00Z') }), reportingTimezone: async () => 'UTC' } as never);
    const result = await service.breakdown(7, { from: '2026-10-18', to: '2026-10-18', campaign_uids: [12], dimension: 'business_goal' });
    expect(result.rows[0]).toMatchObject({ value: 'achieved', dials: 1, success: 0, contacts: 1 });
    const [sql, options] = query.mock.calls[0];
    expect(sql).toContain("'unknown'"); expect(sql).not.toContain('billsec >'); expect(sql).not.toContain('talk_sec >');
    expect(options.replacements).toMatchObject({ tenant: 7, campaigns: [12], outcomePath: dialect === 'postgres' ? 'business_goal_relation' : '$.business_goal_relation' });
  });
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
