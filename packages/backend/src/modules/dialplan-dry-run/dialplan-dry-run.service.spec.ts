import { DEFAULT_HOP_LIMIT } from '@krasterisk/shared';
import { DialplanDryRunService } from './dialplan-dry-run.service';

function playback(id: string) {
  return { id, type: 'playback', params: { files: ['beep'] }, condition: {} };
}

describe('DialplanDryRunService (D-29 linear)', () => {
  let service: DialplanDryRunService;
  let routesService: { findAll: jest.Mock };
  let ivrsService: { findAll: jest.Mock };
  let contextsService: { findAll: jest.Mock };
  let routeReferencesService: { findReferences: jest.Mock };

  beforeEach(() => {
    routesService = { findAll: jest.fn().mockResolvedValue([]) };
    ivrsService = { findAll: jest.fn().mockResolvedValue([]) };
    contextsService = { findAll: jest.fn().mockResolvedValue([]) };
    routeReferencesService = { findReferences: jest.fn().mockResolvedValue([]) };
    service = new DialplanDryRunService(
      routesService as never,
      ivrsService as never,
      contextsService as never,
      routeReferencesService as never,
    );
  });

  it('returns ordered node ids for a linear route without jumps', async () => {
    const result = await service.run(42, {
      host: 'route',
      actions: [playback('a'), playback('b'), { id: 'c', type: 'hangup', params: {}, condition: {} }],
    });

    const visited = result.segments.flatMap((segment) => segment.nodes.map((node) => node.actionId));
    expect(visited).toEqual(['a', 'b', 'c']);
    expect(result.hopsUsed).toBe(0);
    expect(result.hopLimit).toBe(DEFAULT_HOP_LIMIT);
    expect(result.outcome.kind).toBe('terminal');
    expect(result.outcome.actionType).toBe('hangup');
  });

  it('loads tenant entities with vpbx_user_uid from the caller only (T-14-06)', async () => {
    await service.run(77, { host: 'route', actions: [playback('only')] });
    expect(routesService.findAll).toHaveBeenCalledWith(77);
    expect(ivrsService.findAll).toHaveBeenCalledWith(77);
    expect(contextsService.findAll).toHaveBeenCalledWith(77);
  });

  it('accepts draft IVR menu_items and always exposes t/i (D-43)', async () => {
    const result = await service.run(1, {
      host: 'ivr',
      menu_items: [{ digit: '1', actions: [{ id: 'hang', type: 'hangup', params: {}, condition: {} }] }],
    });
    expect(result.ivrInputs?.available).toEqual(expect.arrayContaining(['t', 'i', '1']));
  });
});

describe('DialplanDryRunService (D-44 D-46 D-48 cross-entity)', () => {
  let service: DialplanDryRunService;
  let routesService: { findAll: jest.Mock };
  let ivrsService: { findAll: jest.Mock };
  let contextsService: { findAll: jest.Mock };
  let routeReferencesService: { findReferences: jest.Mock };

  beforeEach(() => {
    routesService = { findAll: jest.fn().mockResolvedValue([]) };
    ivrsService = { findAll: jest.fn().mockResolvedValue([]) };
    contextsService = { findAll: jest.fn().mockResolvedValue([]) };
    routeReferencesService = { findReferences: jest.fn().mockResolvedValue([]) };
    service = new DialplanDryRunService(
      routesService as never,
      ivrsService as never,
      contextsService as never,
      routeReferencesService as never,
    );
  });

  it('enters toivr via tenant IVR fetch and inverse index lookup (D-44 D-48)', async () => {
    ivrsService.findAll.mockResolvedValue([
      {
        uid: 7,
        name: 'Main',
        menu_items: [{ digit: '1', actions: [{ id: 'ivr-hang', type: 'hangup', params: {}, condition: {} }] }],
      },
    ]);

    const result = await service.run(5, {
      host: 'route',
      ivrChoice: '1',
      actions: [{ id: 'jump', type: 'toivr', params: { ivr_uid: 7 }, condition: {} }],
    });

    expect(routeReferencesService.findReferences).toHaveBeenCalledWith('ivr', 7, 5);
    expect(result.segments).toHaveLength(2);
    expect(result.segments[1].entityKind).toBe('ivr');
    expect(result.segments[1].entityUid).toBe(7);
    expect(result.hopsUsed).toBe(1);
    expect(result.outcome.kind).toBe('terminal');
    const visited = result.segments.flatMap((segment) => segment.nodes.map((node) => node.actionId));
    expect(visited).toEqual(['jump', 'ivr-hang']);
  });

  it('does not enter another tenant\'s IVR (T-14-06)', async () => {
    ivrsService.findAll.mockImplementation(async (uid: number) =>
      uid === 1
        ? [{ uid: 10, name: 'Secret', menu_items: [{ digit: '1', actions: [{ id: 'x', type: 'hangup', params: {}, condition: {} }] }] }]
        : [],
    );

    const result = await service.run(2, {
      host: 'route',
      ivrChoice: '1',
      actions: [{ id: 'jump', type: 'toivr', params: { ivr_uid: 10 }, condition: {} }],
    });

    expect(ivrsService.findAll).toHaveBeenCalledWith(2);
    expect(routeReferencesService.findReferences).toHaveBeenCalledWith('ivr', 10, 2);
    expect(result.segments).toHaveLength(1);
    expect(result.outcome.kind).toBe('addressed');
    expect(result.outcome.message).toBe('Цель перехода не найдена');
  });

  it('enters toroute only on exact_only match (D-46)', async () => {
    contextsService.findAll.mockResolvedValue([{ uid: 3, name: 'from-internal' }]);
    routesService.findAll.mockResolvedValue([
      {
        uid: 20,
        name: 'sales',
        context_uid: 3,
        extensions: ['100'],
        active: 1,
        actions: [{ id: 'sales-hang', type: 'hangup', params: {}, condition: {} }],
      },
    ]);

    const result = await service.run(1, {
      host: 'route',
      actions: [
        {
          id: 'to-sales',
          type: 'toroute',
          params: { context: 'from-internal', extension: { source: 'fixed', value: '100' } },
          condition: {},
        },
      ],
    });

    expect(result.segments).toHaveLength(2);
    expect(result.segments[1].entityUid).toBe(20);
    expect(result.hopsUsed).toBe(1);
    expect(result.outcome.kind).toBe('terminal');
  });

  it.each([
    ['ambiguous', [{ uid: 1, extensions: ['100'] }, { uid: 2, extensions: ['100'] }], 'неоднозначность'],
    ['pattern_only', [{ uid: 1, extensions: ['_X.'] }], 'паттерн'],
    ['non_route_context', [], 'не-маршрутный контекст'],
  ] as const)('toroute %s emits addressed with specific reason (D-46)', async (_kind, extras, message) => {
    contextsService.findAll.mockResolvedValue([{ uid: 3, name: 'from-internal' }]);
    routesService.findAll.mockResolvedValue(
      extras.map((row) => ({
        uid: row.uid,
        name: `r${row.uid}`,
        context_uid: 3,
        extensions: row.extensions,
        active: 1,
        actions: [],
      })),
    );

    const result = await service.run(1, {
      host: 'route',
      actions: [
        {
          id: 'jump',
          type: 'toroute',
          params: { context: extras.length === 0 ? 'raw-handwritten' : 'from-internal', extension: { source: 'fixed', value: '100' } },
          condition: {},
        },
      ],
    });

    expect(result.segments).toHaveLength(1);
    expect(result.outcome.kind).toBe('addressed');
    expect(result.outcome.message).toBe(message);
  });

  it('goto stays in the same segment, consumes a hop, and skips the in-between step (D-44)', async () => {
    const result = await service.run(1, {
      host: 'route',
      actions: [
        { id: 'start', type: 'goto', params: { label_name: 'end' }, condition: {} },
        { id: 'skipped', type: 'hangup', params: {}, condition: {} },
        { id: 'end-label', type: 'label', params: { label_name: 'end' }, condition: {} },
        { id: 'after', type: 'hangup', params: {}, condition: {} },
      ],
    });

    const visited = result.segments.flatMap((segment) => segment.nodes.map((node) => node.actionId));
    expect(result.segments).toHaveLength(1);
    expect(result.hopsUsed).toBe(1);
    expect(visited).toEqual(['start', 'end-label', 'after']);
    expect(visited).not.toContain('skipped');
    expect(result.outcome.kind).toBe('terminal');
  });

  it('callback_requested is terminal and consumes no hop (D-38)', async () => {
    const result = await service.run(1, {
      host: 'route',
      actions: [
        { id: 'prompt', type: 'playback', params: {}, condition: {} },
        { id: 'cb', type: 'callback', params: {}, condition: {} },
        { id: 'after', type: 'hangup', params: {}, condition: {} },
      ],
    });

    expect(result.outcome.kind).toBe('callback_requested');
    expect(result.outcome.label).toBe('Итог: абонент заказал обратный звонок');
    expect(result.hopsUsed).toBe(0);
    const visited = result.segments.flatMap((segment) => segment.nodes.map((node) => node.actionId));
    expect(visited).toContain('cb');
    expect(visited).not.toContain('after');
  });
});

