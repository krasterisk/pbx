/** SQL fragments for legacy CDR text timestamps. No user value enters these fragments. */
export function validCdrDateSql(dialect: string): string {
  // Both engines reject invalid civil dates by round-tripping the parsed value.
  // The application/report timezone is the configured DB session timezone.
  const column = 'c.calldate';
  const pattern = "^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01]) ([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$";
  const format = 'YYYY-MM-DD HH24:MI:SS';
  if (dialect === 'postgres') {
    return `(CASE WHEN ${column} ~ '${pattern}' THEN TO_CHAR(TO_TIMESTAMP(${column}, '${format}'), '${format}') = ${column} ELSE FALSE END)`;
  }
  if (dialect === 'mysql') {
    return `(CASE WHEN REGEXP_LIKE(${column}, '${pattern}') THEN DATE_FORMAT(STR_TO_DATE(${column}, '%Y-%m-%d %H:%i:%s'), '%Y-%m-%d %H:%i:%s') = ${column} ELSE FALSE END)`;
  }
  throw new Error(`Unsupported CDR query dialect: ${dialect}`);
}
