import { autodialSqlDate } from './autodial-sql-time.util';
describe('explicit SQL timestamp replacements', () => {
  const instant = new Date('2026-10-16T15:00:00.125Z');
  it.each([['+00:00', '2026-10-16 15:00:00.125'], ['+07:00', '2026-10-16 22:00:00.125'], ['-04:30', '2026-10-16 10:30:00.125']])('uses DB timezone %s regardless of host timezone', (timezone, expected) => {
    expect(autodialSqlDate(instant, { getDialect: () => 'mysql', options: { timezone } } as never)).toBe(expected);
  });
  it('keeps the offset for PostgreSQL timestamptz', () => {
    expect(autodialSqlDate(instant, { getDialect: () => 'postgres' } as never)).toBe(instant.toISOString());
  });
});
