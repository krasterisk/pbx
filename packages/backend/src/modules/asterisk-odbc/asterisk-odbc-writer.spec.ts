const {
  CDR_COLUMNS,
  insertSql,
  eventId,
  isUniqueViolation,
  writeCdr,
  writeQueueLog,
  writeCel,
} = require('./asterisk-odbc-writer.cjs');

describe('asterisk ODBC writer', () => {
  it('emits portable INSERT placeholders per dialect', () => {
    expect(insertSql('cdr', CDR_COLUMNS, 'mysql')).toContain('VALUES (?, ?,');
    expect(insertSql('cdr', CDR_COLUMNS, 'postgres')).toContain('$22)');
    expect(insertSql('queue_log', ['time', 'event_id'], 'postgres')).toBe(
      'INSERT INTO queue_log (time, event_id) VALUES ($1, $2)',
    );
  });

  it('hashes queue_log/CEL event ids stably', () => {
    expect(eventId(['a', 'b'])).toBe(eventId(['a', 'b']));
    expect(eventId(['a', 'b'])).not.toBe(eventId(['a', 'c']));
  });

  it('treats MySQL and PostgreSQL unique violations as replay', () => {
    expect(isUniqueViolation({ code: 'ER_DUP_ENTRY' })).toBe(true);
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
    expect(isUniqueViolation(new Error('unique constraint failed'))).toBe(true);
    expect(isUniqueViolation({ code: 'OTHER' })).toBe(false);
  });

  it('replays a second write with the same unique key', async () => {
    const seen = new Set<string>();
    const exec = async (sql: string, params: unknown[]) => {
      const key = `${sql}|${JSON.stringify(params)}`;
      if (seen.has(key)) {
        const error = new Error('Duplicate entry');
        (error as { code: string }).code = 'ER_DUP_ENTRY';
        throw error;
      }
      seen.add(key);
    };
    const cdr = {
      uniqueid: '1760000000.1', linkedid: '1760000000.1', calldate: '2026-09-20 00:00:00',
      src: '100', dst: 's', dcontext: 'krasterisk-ai-generated', disposition: 'ANSWERED',
      record: '8/calls/20260920/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', vpbx_user_uid: 8,
    };
    await expect(writeCdr(exec, 'mysql', cdr)).resolves.toBe('inserted');
    await expect(writeCdr(exec, 'mysql', cdr)).resolves.toBe('replayed');
    const ql = {
      time: '2026-09-20 00:00:01', callid: '1760000000.1', queuename: 'sales',
      agent: 'NONE', event: 'ENTERQUEUE', data1: '100',
    };
    await expect(writeQueueLog(exec, 'mysql', ql)).resolves.toBe('inserted');
    await expect(writeQueueLog(exec, 'mysql', ql)).resolves.toBe('replayed');
    const cel = {
      eventtype: 'CHAN_START', eventtime: '2026-09-20 00:00:00', uniqueid: '1760000000.1',
      linkedid: '1760000000.1', channame: 'Local/s@krasterisk-ai-generated-0001;2',
    };
    await expect(writeCel(exec, 'mysql', cel)).resolves.toBe('inserted');
    await expect(writeCel(exec, 'mysql', cel)).resolves.toBe('replayed');
  });
});
