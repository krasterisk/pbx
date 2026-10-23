import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CallsService, callCsvCell } from './calls.service';
import { callsPeriod, callsWhere } from './calls-query';
import { classifyCall } from '../../calls/call-record';
import { Sequelize } from 'sequelize';
async function expectBoundSql(
  queries: ReadonlyArray<readonly [string, Record<string, unknown>?]>,
) {
  // Exercise Sequelize's actual replacement lexer, not a SQL substring mock.
  const { injectReplacements } = jest.requireActual<{
    injectReplacements: (
      sql: string,
      dialect: unknown,
      replacements: Record<string, unknown>,
    ) => string;
  }>('sequelize/lib/utils/sql');
  for (const dialect of ['mysql', 'postgres'] as const) {
    const db = new Sequelize('fixture', 'fixture', 'fixture', {
      dialect,
      logging: false,
    });
    try {
      for (const [sql, args] of queries) {
        const rendered = injectReplacements(
          sql,
          (db as unknown as { dialect: unknown }).dialect,
          args || {},
        );
        expect(rendered).not.toMatch(
          /:(?:from|to|cursorAt|cursorId|currentFrom|bucketMs)\b/,
        );
      }
    } finally {
      await db.close();
    }
  }
}
const call = classifyCall(
  42,
  'node',
  [
    {
      id: 1,
      uniqueid: 'u',
      linkedid: 'u',
      calldate: '2026-10-18 10:00:00',
      channel: 'PJSIP/t_main_42-a',
      dstchannel: 'PJSIP/e201_42-b',
      usrc: '79135551122',
      dst: '201',
      dialednum: '7391',
      lastapp: 'Dial',
      disposition: 'ANSWERED',
      duration: 30,
      billsec: 20,
    },
  ],
  { complete: true },
);
function fixture() {
  const snapshotAt=Date.now();
  const ctx = {
    tenant: 42,
    user: { sub: 7, level: 2 },
    scope: { operators: ['201'], queues: [], ownExten: '201' },
    pages: new Set(['cdr']),
    permissionVersion: 'p',
  };
  const access = { resolve: jest.fn().mockResolvedValue(ctx) };
  const store = {
    nodeId: 'node',
    execute: jest.fn(),
    select: jest.fn(async (sql: string, _args?: Record<string, unknown>) => {
      if (sql.includes('dashboard_checkpoints'))
        return [
          {
            source_key: 'projection:node',
            bootstrap_complete: 1,
            updated_at: snapshotAt,
          },
          {
            source_key: 'cdr:node',
            bootstrap_complete: 1,
            initialized_from: 0,
          },
          {
            source_key: 'call-facts:v4:node',
            bootstrap_complete: 1,
            initialized_from: 0,
          },
        ];
      if (sql.includes('GROUP BY'))
        return [
          {
            direction: 'in',
            outcome: 'human',
            amount: 2,
            connected_total: 40,
            connected_sample: 2,
          },
        ];
      return [
        {
          call_key: call.id,
          started_at: Date.parse(call.startedAt),
          payload: JSON.stringify({
            ...call,
            analytics: { state: 'analyzed', recordingId: 'secret' },
          }),
        },
      ];
    }),
    sequelize: {
      transaction: jest.fn(
        async (_options: unknown, work: (tx: unknown) => Promise<unknown>) =>
          work({}),
      ),
    },
  };
  const service = new CallsService(
    access as never,
    store as never,
    { timezone: async () => 'Asia/Krasnoyarsk' } as never,
    { create: jest.fn() } as never,
  );
  return { service, access, store, ctx };
}
describe('company calls projection API', () => {
  it.each(['list', 'overview', 'attention'] as const)('keeps a complete compatible journal available during optional index rebuilding: %s', async (method) => {
    const f = fixture();
    const original = f.store.select.getMockImplementation()!;
    f.store.select.mockImplementation(async (sql, args) => {
      if (sql.includes('dashboard_checkpoints')) return [
        {source_key:'projection:node',bootstrap_complete:0,updated_at:Date.now()-600000},
        {source_key:'cdr:node',bootstrap_complete:1,initialized_from:0,updated_at:Date.now()},
        {source_key:'call-facts:v3:node',bootstrap_complete:1},
        {source_key:'call-facts:v4:node',bootstrap_complete:0},
        {source_key:'semantics:v6:node',bootstrap_complete:1},
      ] as never;
      if (sql.includes('LEFT JOIN call_facts')) return [];
      return original(sql,args);
    });
    const result = await f.service[method]({} as never, {dateFrom:'2026-10-16',dateTo:'2026-10-22',search:'79135551122'});
    expect(result.source.state).toBe('ok');
    const [sql,args] = f.store.select.mock.calls.find(([sql])=>sql.includes('LEFT JOIN call_facts'))!;
    expect(sql).toContain('f.schema_version<3');
    expect(args).toMatchObject({tenant:42,node:'node'});
    expect(sql).toContain('c.node_id= :node');
    expect(sql).not.toContain('dashboard_participants');
    await expectBoundSql(f.store.select.mock.calls);
  });
  it.each(['missingFact','groups','search','semantics'] as const)('does not present incomplete or incompatible history as ready: %s', async (reason) => {
    const f = fixture();
    const original=f.store.select.getMockImplementation()!;
    f.store.select.mockImplementation(async(sql,args)=>{
      if(sql.includes('dashboard_checkpoints'))return [
        {source_key:'projection:node',bootstrap_complete:0,updated_at:Date.now()},
        {source_key:'cdr:node',bootstrap_complete:1,initialized_from:0},
        {source_key:'call-facts:v3:node',bootstrap_complete:1},
        {source_key:'semantics:v6:node',bootstrap_complete:reason==='semantics'?0:1},
      ] as never;
      if(sql.includes('LEFT JOIN call_facts'))return [{call_key:'pending'}] as never;
      return original(sql,args);
    });
    const result=await f.service.list({} as never,reason==='groups'?{groups:['501']}:reason==='search'?{search:'Анна'}:{});
    expect(result.source).toMatchObject({state:'stale',message:'historyBackfillInProgress'});
  });
  it('searches Unicode-normalized directory labels without reducing entity counts to the matched historical name', async () => {
    const f = fixture();
    f.store.select.mockImplementation(async (sql) =>
      sql.includes('d.value')
        ? ([{ value: '201', label: 'Анна', amount: 2 }] as never)
        : [],
    );
    await f.service.facets({} as never, {
      directorySearch: 'АННА',
      dateFrom: '',
      dateTo: '',
    });
    const [sql, args] = f.store.select.mock.calls.find(
      ([, args]) => args?.dimension === 'employee',
    )!;
    expect(sql).toContain('d.search_label LIKE');
    expect(sql).not.toContain('LOWER(d.label)');
    expect(sql).toMatch(/GROUP BY d.value HAVING MAX/);
    expect(args).toMatchObject({ directoryTerm: '%анна%' });
    await expectBoundSql(f.store.select.mock.calls);
  });
  it('does not declare the upgraded directory index ready using an older projection checkpoint', async () => {
    const f = fixture();
    f.store.select.mockResolvedValueOnce([
      {
        source_key: 'projection:node',
        bootstrap_complete: 1,
        updated_at: Date.now(),
      },
      { source_key: 'cdr:node', bootstrap_complete: 1, initialized_from: 0 },
    ] as never);
    const result = await f.service.list({} as never, {
      dateFrom: '',
      dateTo: '',
    });
    expect(result.source).toMatchObject({
      state: 'stale',
      message: 'historyBackfillInProgress',
    });
  });
  it('includes configured groups without calls, uses current names and retains authorized historical groups', async () => {
    const f = fixture();
    f.store.select.mockImplementation(async (sql, args) => {
      if (sql.includes('FROM call_groups')) return [
        { value: '501', label: 'Новая группа' }, { value: '502', label: 'Поддержка' },
      ] as never;
      if (args?.dimension === 'group') return [
        { value: '502', label: 'Старое имя', amount: 3 },
        { value: '503', label: 'Историческая', amount: 1 },
      ] as never;
      return [];
    });
    const result = await f.service.facets({} as never, {
      groups: ['501'], employees: ['201'], dateFrom: '2026-10-16', dateTo: '2026-10-22',
    });
    expect(result.options.group).toEqual([
      { value: '502', label: 'Поддержка', count: 3 },
      { value: '503', label: 'Историческая', count: 1 },
      { value: '501', label: 'Новая группа', count: 0 },
    ]);
    const directory = f.store.select.mock.calls.find(([sql]) => sql.includes('FROM call_groups'))!;
    expect(directory[0]).toContain('vpbx_user_uid=:tenant');
    expect(directory[1]).toEqual({ tenant: 42 });
    const counts = f.store.select.mock.calls.find(([, args]) => args?.dimension === 'group')!;
    expect(counts[1]).toMatchObject({ tenant: 42, values_employees: ['201'], extensions: ['201'] });
    expect(counts[1]).not.toHaveProperty('values_groups');
    expect(counts[0]).toContain('p.tenant=:tenant');
    expect(counts[1]?.to).toBeGreaterThan(counts[1]?.from as number);
    await expectBoundSql(f.store.select.mock.calls);
  });
  it('searches every configured group before limiting, with literal Unicode and number matching', async () => {
    const f = fixture();
    f.store.select.mockImplementation(async sql => sql.includes('FROM call_groups')
      ? Array.from({ length: 205 }, (_, i) => ({ value: String(500 + i), label: i === 204 ? 'НОВАЯ %_!' : `Группа ${i}` })) as never
      : []);
    const all = await f.service.facets({} as never, {});
    expect(all.options.group).toHaveLength(200);
    expect(all.truncated.group).toBe(true);
    for (const directorySearch of ['новая', '%_!', '704']) {
      const result = await f.service.facets({} as never, { directorySearch });
      expect(result.options.group).toEqual([{ value: '704', label: 'НОВАЯ %_!', count: 0 }]);
      expect(result.truncated.group).toBe(false);
    }
  });
  it('defaults to seven calendar days including today without overriding explicit dates', () => {
    const period = callsPeriod({}, 'Asia/Krasnoyarsk', new Date('2026-10-22T19:00:00Z'));
    expect(new Date(period.from).toISOString()).toBe('2026-10-16T17:00:00.000Z');
    expect(new Date(period.to).toISOString()).toBe('2026-10-23T17:00:00.000Z');
    const explicit = callsPeriod({ dateFrom: '2026-10-01', dateTo: '2026-10-02' }, 'Asia/Krasnoyarsk');
    expect(new Date(explicit.from).toISOString()).toBe('2026-09-30T17:00:00.000Z');
    expect(new Date(explicit.to).toISOString()).toBe('2026-10-02T17:00:00.000Z');
  });
  it('computes disjunctive facets under tenant/ACL and keeps other filter groups; binds actual SQL', async () => {
    const f = fixture();
    f.store.select.mockImplementation(async (sql: string) =>
      sql.includes('d.value')
        ? ([{ value: '201', label: 'Анна', amount: 2 }] as never)
        : [],
    );
    const facets = await f.service.facets({} as never, {
      dateFrom: '',
      dateTo: '',
      employees: ['201', '202'],
      departments: ['продажи'],
    });
    expect(facets.options.employee).toEqual([
      { value: '201', label: 'Анна', count: 2 },
    ]);
    expect(facets.analyticsAllowed).toBe(false);
    const queries = f.store.select.mock.calls;
    const employee = queries.find(
      ([, args]) => args?.dimension === 'employee',
    )!;
    const department = queries.find(
      ([, args]) => args?.dimension === 'department',
    )!;
    expect(employee[0]).toContain('p.tenant=:tenant');
    expect(employee[1]).toMatchObject({
      tenant: 42,
      values_departments: ['продажи'],
      extensions: ['201'],
    });
    expect(employee[1]).not.toHaveProperty('values_employees');
    expect(department[1]).toMatchObject({ values_employees: ['201', '202'] });
    expect(department[1]).not.toHaveProperty('values_departments');
    await expectBoundSql(queries);
  });
  it('uses tenant/participant scope and one filter for totals and rows; hides analytics without access', async () => {
    const f = fixture();
    const result = await f.service.list({} as never, {
      dateFrom: '2026-10-18',
      dateTo: '2026-10-18',
      outcome: 'human',
      search: '8 (913) 555-11-22',
    });
    expect(f.access.resolve).toHaveBeenCalledWith({}, 'cdr');
    expect(result).toMatchObject({
      total: 2,
      summary: { total: 2, avgConnectedSec: 20, acceptedPercent: 100 },
      source: { state: 'ok' },
    });
    expect(result.rows[0].analytics).toBeNull();
    expect(result.rows[0]).not.toHaveProperty('linkedid');
    for (const [sql, args] of f.store.select.mock.calls.filter(([sql]) =>
      sql.includes('JOIN call_facts'),
    )) {
      expect(sql).toContain('f.tenant=:tenant');
      expect(sql).toContain('p.tenant=:tenant');
      expect(sql).toContain('f.outcome=:outcome');
      expect(args).toMatchObject({
        tenant: 42,
        extensions: ['201'],
        phone: '%9135551122%',
      });
    }
  });
  it('rejects analytics filters and malformed cursors before reading facts', async () => {
    const f = fixture();
    await expect(
      f.service.list({} as never, { analytics: 'analyzed' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      f.service.list({} as never, { cursor: 'bad' }),
    ).rejects.toThrow('Invalid call cursor');
    expect(f.store.select).not.toHaveBeenCalled();
  });
  it('does not remove scope when opening a direct call URL', async () => {
    const f = fixture();
    f.store.select.mockResolvedValueOnce([]);
    await expect(f.service.detail({} as never, call.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(f.store.select.mock.calls[0][0]).toContain('dashboard_participants');
  });
  it('marks partial history explicitly instead of claiming complete numbers', async () => {
    const f = fixture();
    f.store.select.mockResolvedValueOnce([]);
    expect((await f.service.list({} as never, {})).source.state).toBe(
      'unavailable',
    );
  });
  it('resolves calendar boundaries in the organization timezone', () => {
    const period = callsPeriod(
      { dateFrom: '2026-10-18', dateTo: '2026-10-18' },
      'Asia/Krasnoyarsk',
    );
    expect(new Date(period.from).toISOString()).toBe(
      '2026-10-17T17:00:00.000Z',
    );
    expect(new Date(period.to).toISOString()).toBe('2026-10-18T17:00:00.000Z');
    expect(() => callsPeriod({ dateFrom: '2026-02-30' }, 'UTC')).toThrow();
    expect(
      callsWhere(42, { extension: '202' }, period, {
        operators: ['201'],
        queues: ['700'],
        ownExten: null,
      }).args,
    ).toMatchObject({
      tenant: 42,
      extensions: ['201'],
      queues: ['700'],
      extension: '202',
    });
  });
  it('exports beyond 10000 without an offset or silent truncation', async () => {
    const f = fixture();
    const total = 10001;
    f.store.select.mockImplementation(async (_sql, args) => {
      const offset = args?.cursorId
        ? total - parseInt(String(args.cursorId), 16) + 1
        : 0;
      return Array.from({ length: Math.min(500, total - offset) }, (_, i) => ({
        call_key: (total - offset - i).toString(16).padStart(64, '0'),
        started_at: Date.parse(call.startedAt),
        payload: JSON.stringify(call),
      }));
    });
    const write = jest.fn(async () => true);
    await f.service.exportCsv({} as never, { dateFrom: '', dateTo: '' }, write);
    expect(write).toHaveBeenCalledTimes(total + 1);
    expect(f.store.select).toHaveBeenCalledTimes(21);
    await expectBoundSql(f.store.select.mock.calls);
  });
  it('escapes spreadsheet formulas and does not leak unrelated recordings', async () => {
    expect(callCsvCell('=HYPERLINK("https://example.invalid")')).toContain(
      "'=HYPERLINK",
    );
    const f = fixture();
    await expect(
      f.service.authorizeRecording({} as never, call.id, 'foreign-recording'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('company calls overview', () => {
  it('uses one snapshot, all cohort filters, zero-filled buckets and a preceding equal interval', async () => {
    const f = fixture();
    const original = f.store.select.getMockImplementation()!;
    f.store.select.mockImplementation(async (sql, args) => {
      if (sql.includes('AS local_hour')) return [{ local_hour: Date.parse('2026-10-18T00:00:00Z') / 3600000 + 7, utc_offset: 7 * 3600000, total: 2, missed: 2, human: 0, unknown: 0 }] as never;
      if (sql.includes('FLOOR'))
        return [
          {
            bucket: -1,
            direction: 'in',
            outcome: 'human',
            amount: 3,
            connected_total: 60,
            connected_sample: 3,
          },
          {
            bucket: 0,
            direction: 'in',
            outcome: 'missed',
            amount: 2,
            connected_total: 0,
            connected_sample: 0,
          },
        ] as never;
      return original(sql, args);
    });
    const result = await f.service.overview({} as never, {
      from: '2026-10-18T00:00:00Z',
      to: '2026-10-18T02:00:00Z',
      employees: ['201'],
      recording: 'yes',
      cursor: 'ignored',
    });
    expect(result.summary).toMatchObject({ total: 2, missed: 2 });
    expect(result.previous).toMatchObject({ total: 3, human: 3 });
    expect(result.buckets.map((b) => b.total)).toEqual([2, 0]);
    expect(result.previousPeriod).toEqual({
      from: '2026-10-17T22:00:00.000Z',
      to: '2026-10-18T00:00:00.000Z',
    });
    expect(result.source.state).toBe('ok');
    const [sql, args] = f.store.select.mock.calls.find(([sql]) => sql.includes('FLOOR'))!;
    expect(sql).toContain('call_dimensions');
    expect(sql).toContain('dashboard_participants');
    expect(args).toMatchObject({ tenant: 42, values_employees: ['201'] });
    expect(sql).not.toContain('cursorAt');
    expect(f.store.sequelize.transaction).toHaveBeenCalledTimes(1);
    await expectBoundSql(f.store.select.mock.calls);
  });
  it('rejects unbounded history before SQL and enforces analytics access', async () => {
    const f = fixture();
    await expect(
      f.service.overview({} as never, { dateFrom: '', dateTo: '' }),
    ).rejects.toThrow('at most 366 days');
    await expect(
      f.service.overview({} as never, { analytics: 'analyzed' }),
    ).rejects.toThrow(ForbiddenException);
    expect(f.store.select).not.toHaveBeenCalled();
  });
  it('includes directory participants in normalized numeric and name search without reducing a logical call', () => {
    const scope = { operators: ['201'], queues: [], ownExten: '201' };
    const number = callsWhere(
      42,
      { search: '102' },
      { from: 0, to: 10 },
      scope,
    );
    const name = callsWhere(
      42,
      { search: 'АННА%' },
      { from: 0, to: 10 },
      scope,
    );
    expect(number.sql).toContain('search_d.value LIKE :phone');
    expect(name.args.search).toBe('%анна!%%');
    expect(name.sql).toContain('search_d.search_label');
  });
});

describe('overview cache and participation',()=>{
  it('shares expensive reads only for the same actor, rights, cohort and projection snapshot',async()=>{
    const f=fixture(),q={from:'2026-10-18T00:00:00Z',to:'2026-10-18T02:00:00Z'};
    await f.service.overview({} as never,q);await f.service.overview({} as never,q);
    expect(f.store.select.mock.calls.filter(([sql])=>sql.includes('AS bucket,'))).toHaveLength(1);
    f.ctx.permissionVersion='changed';await f.service.overview({} as never,q);
    expect(f.store.select.mock.calls.filter(([sql])=>sql.includes('AS bucket,'))).toHaveLength(2);
    await f.service.overview({} as never,{...q,employees:['102']});
    expect(f.store.select.mock.calls.filter(([sql])=>sql.includes('AS bucket,'))).toHaveLength(3);
  });
  it('keeps a focused employee as an intersection, not an OR expansion; missing groups are explicit',()=>{
    const f=callsWhere(42,{employees:['101'],extension:'102',focusOutcome:'human',unassignedDimensions:['department','companyNumber']},{from:0,to:100},null);
    expect(f.args).toMatchObject({values_employees:['101'],extension:'102',focusOutcome:'human',unassignedKinds:['department','companyNumber']});
    expect(f.sql).toContain('NOT EXISTS');
  });
  it('rejects attention periods broader than31 days before reading SQL',async()=>{
    const f=fixture();await expect(f.service.attention({} as never,{dateFrom:'',dateTo:''})).rejects.toThrow('at most 31 days');
    expect(f.store.select).not.toHaveBeenCalled();
  });
});

describe('company contact policy',()=>{
  it('requires current administrator rights and rejects invalid hours before writing',async()=>{
    const f=fixture();await expect(f.service.setContactPolicy({} as never,12)).rejects.toThrow(ForbiddenException);
    expect(f.store.execute).not.toHaveBeenCalled();
    f.ctx.user.level=1;
    for(const hours of [0,169,NaN,1.5])await expect(f.service.setContactPolicy({} as never,hours)).rejects.toThrow('Contact window');
    expect(f.store.execute).not.toHaveBeenCalled();
  });
  it('binds policy writes to the resolved tenant and uses a serializable transaction',async()=>{
    const f=fixture();f.ctx.user.level=1;
    await f.service.setContactPolicy({vpbx_user_uid:999} as never,48);
    expect(f.store.sequelize.transaction).toHaveBeenCalledWith(expect.objectContaining({isolationLevel:'SERIALIZABLE'}),expect.any(Function));
    expect(f.store.execute).toHaveBeenCalledWith(expect.stringContaining('tenant_settings'),expect.objectContaining({tenant:42,value:'48'}),expect.anything());
  });
});
