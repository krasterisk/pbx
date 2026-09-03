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

  beforeEach(() => {
    routesService = { findAll: jest.fn().mockResolvedValue([]) };
    ivrsService = { findAll: jest.fn().mockResolvedValue([]) };
    contextsService = { findAll: jest.fn().mockResolvedValue([]) };
    service = new DialplanDryRunService(
      routesService as never,
      ivrsService as never,
      contextsService as never,
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
