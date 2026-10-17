import { CallCenterLossesService, recoverySecondsSql } from './callcenter-losses.service';

const FROM = new Date('2026-07-14T17:00:00.000Z');
const TO = new Date('2026-07-15T12:00:00.000Z');

function setup(dialect = 'postgres') {
  const model = {
    sequelize: { getDialect: () => dialect },
    findOne: jest.fn(),
    count: jest.fn(),
  };
  return { model, service: new CallCenterLossesService(model as any) };
}

describe('recoverySecondsSql', () => {
  it('uses the dialect own date difference', () => {
    expect(recoverySecondsSql('postgres')).toContain('EXTRACT(EPOCH');
    expect(recoverySecondsSql('mysql')).toContain('TIMESTAMPDIFF(SECOND');
    expect(recoverySecondsSql('mariadb')).toContain('TIMESTAMPDIFF(SECOND');
  });
});

describe('CallCenterLossesService', () => {
  it('maps the aggregate row; pending is what nobody recovered', async () => {
    const { model, service } = setup();
    model.findOne.mockResolvedValue({ total: '10', agent: '4', fast: '2', slow: '3', client: '1', b5: '1', b20: '4', b60: '3', b60p: '2' });
    model.count.mockResolvedValue(8);

    const res = await service.getLosses(7, { from: FROM, to: TO }, { from: new Date('2026-07-07T17:00:00Z'), to: new Date('2026-07-08T12:00:00Z') }, []);

    expect(res).toEqual({
      total: 10,
      previousTotal: 8,
      recoveredByAgent: 4,
      recoveredWithin15: 2,
      recoveredWithin60: 3,
      clientCalledBack: 1,
      pending: 5,
      waitBuckets: { upTo5: 1, upTo20: 4, upTo60: 3, over60: 2 },
    });
  });

  it('is all zeros for an empty period and has no previous total without a comparison window', async () => {
    const { model, service } = setup();
    model.findOne.mockResolvedValue(null);
    const res = await service.getLosses(7, { from: FROM, to: TO }, null, []);
    expect(res).toMatchObject({ total: 0, previousTotal: null, pending: 0, recoveredByAgent: 0 });
    expect(model.count).not.toHaveBeenCalled();
  });

  it('never goes negative when counters disagree', async () => {
    const { model, service } = setup();
    model.findOne.mockResolvedValue({ total: 2, agent: 2, client: 1 });
    expect((await service.getLosses(7, { from: FROM, to: TO }, null, [])).pending).toBe(0);
  });

  it('scopes by tenant, skips personal misses and applies the queue filter', async () => {
    const { model, service } = setup();
    model.findOne.mockResolvedValue(null);
    await service.getLosses(7, { from: FROM, to: TO }, null, ['sales', 'support']);
    const where = model.findOne.mock.calls[0][0].where;
    expect(where.user_uid).toBe(7);
    expect(where.personal).toBe(false);
    expect(Object.getOwnPropertySymbols(where.created_at)).toHaveLength(2);
    expect(Object.getOwnPropertySymbols(where.queue_name)).toHaveLength(1);
  });

  it('puts the dialect date difference into the recovery counters', async () => {
    const mysql = setup('mysql');
    mysql.model.findOne.mockResolvedValue(null);
    await mysql.service.getLosses(7, { from: FROM, to: TO }, null, []);
    expect(JSON.stringify(mysql.model.findOne.mock.calls[0][0].attributes)).toContain('TIMESTAMPDIFF');

    const pg = setup('postgres');
    pg.model.findOne.mockResolvedValue(null);
    await pg.service.getLosses(7, { from: FROM, to: TO }, null, []);
    expect(JSON.stringify(pg.model.findOne.mock.calls[0][0].attributes)).toContain('EXTRACT(EPOCH');
  });
});
