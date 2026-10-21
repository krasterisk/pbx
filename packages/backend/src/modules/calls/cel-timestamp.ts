interface CelReader {
  select<T>(sql: string, args?: Record<string, unknown>): Promise<T[]>;
  sequelize?: { getDialect(): string };
}
const expressions = new WeakMap<CelReader, Promise<string>>();
/** TIMESTAMP instants must not be interpreted a second time in the PBX wall-clock zone. */
export function celTimestampExpression(reader: CelReader): Promise<string> {
  const cached = expressions.get(reader);
  if (cached) return cached;
  const expression = (async () => {
    const dialect = reader.sequelize?.getDialect?.();
    if (dialect !== 'mysql' && dialect !== 'mariadb' && dialect !== 'postgres') return "CONCAT(eventtime,'')";
    const [column] = await reader.select<{ data_type: string }>(
      `SELECT data_type AS data_type FROM information_schema.columns WHERE table_schema=${dialect === 'postgres' ? 'current_schema()' : 'DATABASE()'} AND table_name='cel' AND column_name='eventtime'`,
    );
    if (!column) throw new Error('CEL eventtime column is unavailable');
    if (dialect === 'postgres') {
      return column.data_type.toLowerCase() === 'timestamp with time zone'
        ? `TO_CHAR(eventtime AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`
        : "CONCAT(eventtime,'')";
    }
    return column.data_type.toLowerCase() === 'timestamp'
      ? "DATE_FORMAT(CONVERT_TZ(eventtime,@@session.time_zone,'+00:00'),'%Y-%m-%dT%H:%i:%s.%fZ')"
      : "CONCAT(eventtime,'')";
  })();
  expressions.set(reader, expression);
  void expression.catch(() => expressions.delete(reader));
  return expression;
}
