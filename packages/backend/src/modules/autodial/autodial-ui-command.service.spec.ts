import { AutodialUiCommandService } from './autodial-ui-command.service';

describe.each(['mysql', 'postgres'])('browser create commands (%s SQL branch)', (dialect) => {
  function setup() {
    const rows = new Map<string, { operation: string; request_hash: string; resource_uid: number | null }>();
    const db = {
      getDialect: () => dialect,
      transaction: jest.fn(async (_options, callback) => {
        const before = structuredClone(rows);
        try { return await callback({}); } catch (error) { rows.clear(); for (const [key, row] of before) rows.set(key, row); throw error; }
      }),
      query: jest.fn(async (sql: string, { replacements: r }: { replacements: Record<string, unknown> }) => {
        const key = `${r.tenant}:${r.actor}:${r.key}`;
        if (sql.startsWith('INSERT') && !rows.has(key)) rows.set(key, { operation: String(r.operation), request_hash: String(r.hash), resource_uid: null });
        if (sql.startsWith('SELECT')) return rows.has(key) ? [rows.get(key)] : [];
        if (sql.startsWith('UPDATE')) rows.get(key)!.resource_uid = Number(r.uid);
        return [];
      }),
    };
    return { db, service: new AutodialUiCommandService(db as never) };
  }
  it('returns the same resource for a retry and ignores JSON property order', async () => {
    const { service } = setup(), write = jest.fn().mockResolvedValue({ uid: 8 });
    expect(await service.run(71, 4, 'command-0001', 'create_base', { name: 'A', description: 'B' }, write)).toBe(8);
    expect(await service.run(71, 4, 'command-0001', 'create_base', { description: 'B', name: 'A' }, write)).toBe(8);
    expect(write).toHaveBeenCalledTimes(1);
    expect(await service.status(71, 4, 'command-0001')).toEqual({ status: 'completed', operation: 'create_base', resource_uid: 8 });
  });
  it('rejects different payloads and operations for a committed identity', async () => {
    const { service } = setup(), write = jest.fn().mockResolvedValue({ uid: 8 });
    await service.run(71, 4, 'command-0001', 'create_base', { name: 'A' }, write);
    for (const [operation, payload] of [['create_base', { name: 'B' }], ['create_campaign', { name: 'A' }]] as const) {
      await expect(service.run(71, 4, 'command-0001', operation, payload, write)).rejects.toMatchObject({ response: { code: 'AC_UI_COMMAND_CONFLICT' } });
    }
    expect(write).toHaveBeenCalledTimes(1);
  });
  it('separates actors and tenants and does not leak another actor’s resource', async () => {
    const { service } = setup(), write = jest.fn().mockResolvedValueOnce({ uid: 8 }).mockResolvedValueOnce({ uid: 9 });
    await service.run(71, 4, 'command-0001', 'create_base', {}, write);
    expect(await service.status(71, 5, 'command-0001')).toEqual({ status: 'unknown' });
    expect(await service.status(72, 4, 'command-0001')).toEqual({ status: 'unknown' });
    expect(await service.run(72, 4, 'command-0001', 'create_base', {}, write)).toBe(9);
  });
  it('rolls back a failed write and permits a later explicit retry', async () => {
    const { service } = setup(), write = jest.fn().mockRejectedValueOnce(new Error('Write failed')).mockResolvedValueOnce({ uid: 8 });
    await expect(service.run(71, 4, 'command-0001', 'create_base', {}, write)).rejects.toThrow('Write failed');
    expect(await service.status(71, 4, 'command-0001')).toEqual({ status: 'unknown' });
    expect(await service.run(71, 4, 'command-0001', 'create_base', {}, write)).toBe(8);
  });
});
