import { NEVER, firstValueFrom, take, toArray } from 'rxjs';
import { CallCenterWallboardController } from './callcenter-wallboard.controller';

describe('CallCenterWallboardController SSE', () => {
  const req = { user: { vpbx_user_uid: 7 } } as any;

  function build(settings: () => Promise<any>) {
    const state = {
      getSnapshot: jest.fn().mockReturnValue({ agents: [], queues: [], calls: [] }),
      getEventStream: jest.fn().mockReturnValue(NEVER),
    };
    const settingsService = { getTenantSettings: jest.fn(settings) };
    const controller = new CallCenterWallboardController(
      state as any,
      {} as any,
      settingsService as any,
    );
    return { controller, settingsService };
  }

  it('opens with the snapshot, then sends the tenant visual thresholds', async () => {
    const { controller, settingsService } = build(async () => ({
      alert_thresholds: {
        sla_critical_pct: 85,
        max_wait_sec: 45,
        abandon_rate_pct: 8,
        agents_available_min: 0,
        // anything else must never reach a public screen
        secret_key: 123,
      },
    }));

    const events = await firstValueFrom(controller.events(req).pipe(take(2), toArray()));

    expect(events[0].type).toBe('fullSnapshot');
    expect(events[1].type).toBe('thresholds');
    expect(JSON.parse(events[1].data as string)).toEqual({
      sla_critical_pct: 85,
      max_wait_sec: 45,
      abandon_rate_pct: 8,
      agents_available_min: 0,
    });
    expect(settingsService.getTenantSettings).toHaveBeenCalledWith(7);
  });

  it('keeps the TV stream alive when the settings read fails', async () => {
    const { controller } = build(async () => {
      throw new Error('db down');
    });

    const stream = controller.events(req);
    const first = await firstValueFrom(stream.pipe(take(1)));
    expect(first.type).toBe('fullSnapshot');
  });
});
