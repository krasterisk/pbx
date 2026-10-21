import { celTimestampExpression } from './cel-timestamp';
import { parseDashboardTimestamp } from './call-classifier';

describe('CEL source timestamp semantics', () => {
  function reader(dialect: string, data_type: string) {
    return { sequelize: { getDialect: () => dialect }, select: jest.fn().mockResolvedValue([{ data_type }]) };
  }
  it('serializes MySQL TIMESTAMP as UTC, independently of the CDR timezone', async () => {
    const source = reader('mysql', 'timestamp');
    expect(await celTimestampExpression(source)).toContain("CONVERT_TZ(eventtime,@@session.time_zone,'+00:00')");
    expect(parseDashboardTimestamp('2026-10-21T03:52:38.000000Z', 'Europe/Moscow')).toBe(Date.parse('2026-10-21T03:52:38Z'));
    await celTimestampExpression(source);
    expect(source.select).toHaveBeenCalledTimes(1);
  });
  it.each(['mysql', 'mariadb'])('preserves %s DATETIME as PBX wall time', async dialect => {
    expect(await celTimestampExpression(reader(dialect, 'datetime'))).toBe("CONCAT(eventtime,'')");
  });
  it('preserves PostgreSQL timestamp without time zone', async () => {
    expect(await celTimestampExpression(reader('postgres', 'timestamp without time zone'))).toBe("CONCAT(eventtime,'')");
  });
  it('serializes PostgreSQL timestamptz with an explicit UTC zone', async () => {
    expect(await celTimestampExpression(reader('postgres', 'timestamp with time zone'))).toContain("eventtime AT TIME ZONE 'UTC'");
  });
  it('retries schema discovery after a transient failure', async () => {
    const source = reader('mysql', 'timestamp');
    source.select.mockRejectedValueOnce(new Error('unavailable'));
    await expect(celTimestampExpression(source)).rejects.toThrow('unavailable');
    await expect(celTimestampExpression(source)).resolves.toContain('CONVERT_TZ');
  });
});
