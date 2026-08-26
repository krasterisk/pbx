import { RoutesService } from './routes.service';
import type { ITimeGroupInterval } from '@krasterisk/shared';
import { AsteriskDialplanUtils } from '../../shared/utils/dialplan.util';
import { ActionLog } from '../logger/action-log.model';

jest.mock('../logger/action-log.model', () => ({
  ActionLog: { create: jest.fn().mockResolvedValue({}) },
}));

/**
 * Unit tests for RoutesService bindings CRUD (D-03, D-05, T-05-03).
 *
 * Tests: replace-all bindings strategy on update, tenant ownership validation
 * of phonebook_uid, bindings included + ordered by position ASC on reads.
 */
describe('RoutesService', () => {
  let routeModel: any;
  let bindingModel: any;
  let phonebookModel: any;
  let timeGroupsService: any;
  let service: RoutesService;

  beforeEach(() => {
    routeModel = {
      max: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      findOne: jest.fn(),
      findAll: jest.fn(),
      destroy: jest.fn(),
      update: jest.fn(),
    };
    bindingModel = {
      destroy: jest.fn().mockResolvedValue(0),
      bulkCreate: jest.fn().mockResolvedValue([]),
      findAll: jest.fn(),
    };
    phonebookModel = {
      count: jest.fn(),
    };
    timeGroupsService = {
      findAll: jest.fn().mockResolvedValue([]),
    };
    service = new RoutesService(routeModel, bindingModel, phonebookModel, timeGroupsService);
  });

  const sampleInterval: ITimeGroupInterval = {
    time_start: '09:00',
    time_end: '18:00',
    days_of_week: 'mon-fri',
    days_of_month: '*',
    months: '*',
  };

  const intervalExpr = `${sampleInterval.time_start}-${sampleInterval.time_end},${sampleInterval.days_of_week},${sampleInterval.days_of_month},${sampleInterval.months}`;

  function timeGroupMap(uid: number, intervals: ITimeGroupInterval[] = [sampleInterval]): Map<number, string[]> {
    const exprs = intervals.map(
      (i) => `${i.time_start}-${i.time_end},${i.days_of_week},${i.days_of_month},${i.months}`,
    );
    return new Map([[uid, exprs]]);
  }

  function baseRoute(overrides: Record<string, unknown> = {}): any {
    return {
      uid: 1,
      name: 'Test route',
      extensions: ['100'],
      actions: [],
      options: {},
      webhooks: {},
      bindings: [],
      ...overrides,
    };
  }

  describe('update — bindings replace-all', () => {
    it('destroys old bindings and bulkCreates new ones scoped to the tenant, positioned by array index', async () => {
      const existingRoute = { uid: 5, context_uid: 1, update: jest.fn().mockResolvedValue(undefined) };
      routeModel.findOne
        .mockResolvedValueOnce(existingRoute) // findOne() inside update() — pre-update fetch
        .mockResolvedValueOnce({ uid: 5, bindings: [] }); // findOne() at the end — post-update refetch
      phonebookModel.count.mockResolvedValueOnce(1);

      const bindings = [{ phonebook_uid: 10, match_mode: 'on_match', behavior_type: 'set_name' }];
      await service.update(5, { name: 'R', bindings } as any, 100);

      expect(bindingModel.destroy).toHaveBeenCalledWith({ where: { route_uid: 5, user_uid: 100 } });
      expect(bindingModel.bulkCreate).toHaveBeenCalledWith([
        expect.objectContaining({
          route_uid: 5,
          phonebook_uid: 10,
          position: 0,
          match_mode: 'on_match',
          behavior_type: 'set_name',
          user_uid: 100,
        }),
      ]);
    });

    it('positions multiple bindings by their array index', async () => {
      const existingRoute = { uid: 5, context_uid: 1, update: jest.fn().mockResolvedValue(undefined) };
      routeModel.findOne
        .mockResolvedValueOnce(existingRoute)
        .mockResolvedValueOnce({ uid: 5, bindings: [] });
      phonebookModel.count.mockResolvedValueOnce(2);

      const bindings = [
        { phonebook_uid: 10, match_mode: 'on_match', behavior_type: 'drop' },
        { phonebook_uid: 20, match_mode: 'on_match', behavior_type: 'set_name' },
      ];
      await service.update(5, { bindings } as any, 100);

      const created = bindingModel.bulkCreate.mock.calls[0][0];
      expect(created[0].position).toBe(0);
      expect(created[0].phonebook_uid).toBe(10);
      expect(created[1].position).toBe(1);
      expect(created[1].phonebook_uid).toBe(20);
    });

    it('normalizes legacy blacklist/whitelist behavior_type to drop on save', async () => {
      const existingRoute = { uid: 5, context_uid: 1, update: jest.fn().mockResolvedValue(undefined) };
      routeModel.findOne
        .mockResolvedValueOnce(existingRoute)
        .mockResolvedValueOnce({ uid: 5, bindings: [] });
      phonebookModel.count.mockResolvedValueOnce(1);

      await service.update(5, {
        bindings: [{ phonebook_uid: 10, match_mode: 'on_match', behavior_type: 'blacklist' }],
      } as any, 100);

      expect(bindingModel.bulkCreate.mock.calls[0][0][0].behavior_type).toBe('drop');
    });

    it('rejects bindings referencing a phonebook from another tenant, without touching bindingModel', async () => {
      const existingRoute = { uid: 5, context_uid: 1, update: jest.fn() };
      routeModel.findOne.mockResolvedValueOnce(existingRoute);
      phonebookModel.count.mockResolvedValueOnce(0); // owned-count mismatch → foreign phonebook_uid

      const bindings = [{ phonebook_uid: 999, match_mode: 'on_match', behavior_type: 'vars_only' }];
      await expect(service.update(5, { bindings } as any, 100)).rejects.toThrow();
      expect(bindingModel.destroy).not.toHaveBeenCalled();
      expect(bindingModel.bulkCreate).not.toHaveBeenCalled();
    });

    it('leaves bindings untouched when bindings is undefined in the payload', async () => {
      const existingRoute = { uid: 5, context_uid: 1, update: jest.fn().mockResolvedValue(undefined) };
      routeModel.findOne
        .mockResolvedValueOnce(existingRoute)
        .mockResolvedValueOnce({ uid: 5, bindings: [] });

      await service.update(5, { name: 'R only' } as any, 100);

      expect(bindingModel.destroy).not.toHaveBeenCalled();
      expect(bindingModel.bulkCreate).not.toHaveBeenCalled();
    });
  });

  describe('findAll / findAllByContext / findOne — bindings included, ordered by position ASC', () => {
    it('findAll includes the bindings association ordered by position ASC', async () => {
      routeModel.findAll.mockResolvedValue([]);
      await service.findAll(100);

      const callArgs = routeModel.findAll.mock.calls[0][0];
      expect(callArgs.include[0]).toEqual(expect.objectContaining({ as: 'bindings' }));
      expect(callArgs.order).toEqual(
        expect.arrayContaining([[expect.objectContaining({ as: 'bindings' }), 'position', 'ASC']]),
      );
    });

    it('findAllByContext scopes by context_uid + user_uid and includes bindings', async () => {
      routeModel.findAll.mockResolvedValue([]);
      await service.findAllByContext(7, 100);

      const callArgs = routeModel.findAll.mock.calls[0][0];
      expect(callArgs.where).toEqual({ context_uid: 7, user_uid: 100 });
      expect(callArgs.include[0]).toEqual(expect.objectContaining({ as: 'bindings' }));
    });

    it('findOne throws NotFoundException for a route belonging to another tenant', async () => {
      routeModel.findOne.mockResolvedValue(null);
      await expect(service.findOne(5, 999)).rejects.toThrow('Route not found');
    });
  });

  describe('generateRouteDialplan — action order vs raw_dialplan', () => {
    it('emits actions in array order when raw_dialplan is empty', () => {
      const route = baseRoute({
        extensions: ['2236246'],
        name: '2236246',
        actions: [
          { type: 'voicerobot', params: { robot_uid: 4 }, condition: {} },
          { type: 'toexten', params: { target: { source: 'fixed', value: '201' }, webrtc: true }, condition: {} },
        ],
      });

      const dp = service.generateRouteDialplan(route, 0, false);
      const stasis = dp.indexOf('Stasis(');
      const dial = dp.indexOf('Dial(');
      expect(stasis).toBeGreaterThan(-1);
      expect(dial).toBeGreaterThan(-1);
      expect(stasis).toBeLessThan(dial);
    });

    it('ignores a leftover raw snapshot when the action chain is present', () => {
      const route = baseRoute({
        extensions: ['2236246'],
        name: '2236246',
        actions: [
          { type: 'voicerobot', params: { robot_uid: 4 }, condition: {} },
          { type: 'toexten', params: { target: { source: 'fixed', value: '201' }, webrtc: true }, condition: {} },
        ],
        raw_dialplan: [
          'exten => 2236246,1,NoOp(Route: 2236246)',
          'same => n,Dial(PJSIP/e201_0&PJSIP/ew201_0,60,tThH)',
          'same => n,Stasis(krasterisk_robot_dev,4)',
        ].join('\n'),
      });

      const dp = service.generateRouteDialplan(route, 0, false);
      expect(dp.indexOf('Stasis(')).toBeLessThan(dp.indexOf('Dial('));
    });

    it('uses stored raw_dialplan when dialplan_source is raw', () => {
      const route = baseRoute({
        extensions: ['2236246'],
        actions: [
          { type: 'voicerobot', params: { robot_uid: 4 }, condition: {} },
          { type: 'toexten', params: { target: { source: 'fixed', value: '201' }, webrtc: true }, condition: {} },
        ],
        options: { dialplan_source: 'raw' },
        raw_dialplan: [
          'exten => 2236246,1,NoOp(Route: 2236246)',
          'same => n,Dial(PJSIP/e201_0&PJSIP/ew201_0,60,tThH)',
          'same => n,Stasis(krasterisk_robot_dev,4)',
        ].join('\n'),
      });

      const dp = service.generateRouteDialplan(route, 0, false);
      expect(dp.indexOf('Dial(')).toBeLessThan(dp.indexOf('Stasis('));
    });
  });

  describe('generateRouteDialplan — binding Gosub emission', () => {
    it('emits one Gosub(pb_bind_{uid}_{vpbx}) per binding, ordered by position ASC', () => {
      const route: any = {
        uid: 1,
        name: 'Test route',
        extensions: ['100'],
        actions: [],
        options: {},
        webhooks: {},
        bindings: [
          { uid: 5, position: 1 },
          { uid: 3, position: 0 },
        ],
      };

      const dp = service.generateRouteDialplan(route, 100, false);
      const gosubLines = dp.split('\n').filter((l) => l.includes('Gosub(pb_bind_'));

      expect(gosubLines).toEqual([
        'same => n,Gosub(pb_bind_3_100,s,1)',
        'same => n,Gosub(pb_bind_5_100,s,1)',
      ]);
    });

    it('runs the legacy check_blacklist line only when there are no bindings', () => {
      const routeWithBindings: any = {
        uid: 1, name: 'R', extensions: ['100'], actions: [], webhooks: {},
        options: { check_blacklist: true },
        bindings: [{ uid: 1, position: 0 }],
      };
      const dpWithBindings = service.generateRouteDialplan(routeWithBindings, 100, false);
      expect(dpWithBindings).not.toContain('check_blacklist.php');

      const routeNoBindings: any = {
        uid: 2, name: 'R2', extensions: ['101'], actions: [], webhooks: {},
        options: { check_blacklist: true },
        bindings: [],
      };
      const dpNoBindings = service.generateRouteDialplan(routeNoBindings, 100, false);
      expect(dpNoBindings).toContain('check_blacklist.php');
    });
  });

  describe('generateRouteDialplan — time_group_uid ExecIfTime guard', () => {
    it('emits Set(__WT_12=0) + ExecIfTime guard once when two actions share time_group_uid=12', () => {
      const route = baseRoute({
        actions: [
          { type: 'hangup', condition: { time_group_uid: 12 } },
          { type: 'hangup', condition: { time_group_uid: 12 } },
        ],
      });

      const dp = service.generateRouteDialplan(route, 100, false, timeGroupMap(12));
      const lines = dp.split('\n');

      expect(lines.filter((l) => l.includes('Set(__WT_12=0)'))).toHaveLength(1);
      expect(lines.filter((l) => l.includes(`ExecIfTime(${intervalExpr}?Set(__WT_12=1))`))).toHaveLength(1);
      expect(lines.filter((l) => l.includes('ExecIf($["${WT_12}"="1"]?Hangup())'))).toHaveLength(2);
    });

    it('emits separate guards once per distinct time_group_uid', () => {
      const route = baseRoute({
        actions: [
          { type: 'hangup', condition: { time_group_uid: 12 } },
          { type: 'hangup', condition: { time_group_uid: 34 } },
        ],
      });

      const map = new Map<number, string[]>([
        [12, [intervalExpr]],
        [34, ['08:00-12:00,sat-sun,*,*']],
      ]);

      const dp = service.generateRouteDialplan(route, 100, false, map);
      const lines = dp.split('\n');

      expect(lines.filter((l) => l.includes('Set(__WT_12=0)'))).toHaveLength(1);
      expect(lines.filter((l) => l.includes('Set(__WT_34=0)'))).toHaveLength(1);
      expect(lines.filter((l) => l.includes('ExecIfTime(08:00-12:00,sat-sun,*,*?Set(__WT_34=1))'))).toHaveLength(1);
      expect(lines.filter((l) => l.includes('ExecIf($["${WT_12}"="1"]?'))).toHaveLength(1);
      expect(lines.filter((l) => l.includes('ExecIf($["${WT_34}"="1"]?'))).toHaveLength(1);
    });

    it('leaves actions without time_group_uid unwrapped', () => {
      const route = baseRoute({
        actions: [
          { type: 'hangup' },
          { type: 'hangup', condition: { time_group_uid: 12 } },
        ],
      });

      const dp = service.generateRouteDialplan(route, 100, false, timeGroupMap(12));
      const hangupLines = dp.split('\n').filter((l) => l.includes('Hangup()'));

      expect(hangupLines).toContain('same => n,Hangup()');
      expect(hangupLines).toContain('same => n,ExecIf($["${WT_12}"="1"]?Hangup())');
    });

    it('uses the TimeGroup interval format in ExecIfTime expression', () => {
      const intervals: ITimeGroupInterval[] = [
        {
          time_start: '10:30',
          time_end: '11:45',
          days_of_week: 'mon-wed',
          days_of_month: '1-15',
          months: 'jan-mar',
        },
      ];
      const route = baseRoute({
        actions: [{ type: 'hangup', condition: { time_group_uid: 7 } }],
      });

      const dp = service.generateRouteDialplan(route, 100, false, timeGroupMap(7, intervals));

      expect(dp).toContain('ExecIfTime(10:30-11:45,mon-wed,1-15,jan-mar?Set(__WT_7=1))');
    });
  });

  describe('generateRouteDialplan — call recording', () => {
    it('emits mono MixMonitor with b flag for on-answer recording', () => {
      const route = baseRoute({ options: { record: true } });
      const dp = service.generateRouteDialplan(route, 100, false);

      expect(dp).toContain('MixMonitor(/usr/records/100/calls/${path}/${fname}.wav,b,${monopt})');
      expect(dp).toContain('-ac 1');
      expect(dp).not.toContain('__REC_STEREO=1');
    });

    it('emits stereo MixMonitor with D flag and raw extension', () => {
      const route = baseRoute({ options: { record: true, record_stereo: true } });
      const dp = service.generateRouteDialplan(route, 100, false);

      expect(dp).toContain('Set(__REC_STEREO=1)');
      expect(dp).toContain('MixMonitor(/usr/records/100/calls/${path}/${fname}.raw,bD,${monopt})');
      expect(dp).toContain('-f s16le');
      expect(dp).toContain('-ac 2');
    });

    it('combines record_all and record_stereo without b flag', () => {
      const route = baseRoute({
        options: { record: true, record_all: true, record_stereo: true },
      });
      const dp = service.generateRouteDialplan(route, 100, false);

      expect(dp).toContain('MixMonitor(/usr/records/100/calls/${path}/${fname}.raw,D,${monopt})');
      expect(dp).not.toMatch(/MixMonitor\([^)]*,b/);
    });
  });

  describe('characterization (Wave 0) — time-group wrap and buildContextName', () => {
    const prevKey = AsteriskDialplanUtils.dialplanApiKey;
    const prevUrl = AsteriskDialplanUtils.backendBaseUrl;

    beforeEach(() => {
      AsteriskDialplanUtils.backendBaseUrl = 'http://backend.test/api';
      AsteriskDialplanUtils.dialplanApiKey = 'wave0-key';
    });

    afterEach(() => {
      AsteriskDialplanUtils.backendBaseUrl = prevUrl;
      AsteriskDialplanUtils.dialplanApiKey = prevKey;
    });

    /**
     * 12-RESEARCH.md Pitfall 3 — renderActionChain wraps each notify line; no ?same =>.
     */
    it('time_group_uid wraps every notify line via renderActionChain (Pitfall 3)', () => {
      const route = baseRoute({
        extensions: ['100'],
        actions: [
          {
            type: 'notify',
            params: {
              channels: ['email'],
              recipients: { email: 'ops@example.com' },
              subject: 'Call from ${CALLERID(num)}',
              body: 'Incoming on ${EXTEN}',
            },
            condition: { time_group_uid: 12 },
          },
        ],
      });

      const dp = service.generateRouteDialplan(route, 42, false, timeGroupMap(12));
      expect(dp).not.toContain('?same =>');
      const g = '"${WT_12}"="1"';
      expect(dp).toContain(`same => n,ExecIf($[${g}]?Set(__KNOTIFY_MSG=Incoming on \${EXTEN}))`);
      expect(dp).toContain(`same => n,ExecIf($[${g}]?Set(__KNOTIFY_SUBJ=Call from \${CALLERID(num)}))`);
      expect(dp).toContain('/internal/dialplan/notify');
    });

    it('cmd action on generate path logs cmd_apply (D-42)', () => {
      (ActionLog.create as jest.Mock).mockClear();
      const route = baseRoute({
        actions: [{ id: 3, type: 'cmd', params: { command: 'NoOp(route-cmd)' }, condition: {} }],
      });
      service.generateRouteDialplan(route, 42, true);
      expect(ActionLog.create).toHaveBeenCalled();
      expect((ActionLog.create as jest.Mock).mock.calls[0][0].action).toBe('cmd_apply');
    });

    it('route without cmd does not log cmd_apply', () => {
      (ActionLog.create as jest.Mock).mockClear();
      const route = baseRoute({
        actions: [{ type: 'hangup', params: {}, condition: {} }],
      });
      service.generateRouteDialplan(route, 42, true);
      const cmdApplies = (ActionLog.create as jest.Mock).mock.calls.filter(
        (c) => c[0]?.action === 'cmd_apply',
      );
      expect(cmdApplies).toHaveLength(0);
    });

    it('buildContextName endsWith guard keeps an already-suffixed context (D-42 contrast vs toroute)', async () => {
      routeModel.findAll.mockResolvedValue([]);
      const dp = await service.generateContextDialplan(
        1,
        42,
        'sip-out42',
        ['from-internal42', 'default'],
      );
      expect(dp).toBe(
        ['[sip-out42]', 'include => from-internal42', 'include => default42', ''].join('\n'),
      );
    });
  });
});
