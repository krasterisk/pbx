import { AutodialPacerService } from './autodial-pacer.service';
import { AutodialStateService } from './autodial-state.service';
import type { IAutodialSchedule } from '@krasterisk/shared';

function disabledSchedule(): IAutodialSchedule {
  return {
    uid: 1,
    campaign_uid: 9,
    kind: 'weekly',
    weekday: null,
    time_from: '09:00',
    time_to: '18:00',
    timezone: 'UTC',
    date_from: null,
    date_to: null,
    enabled: false,
  };
}

describe('autodial pacing safety', () => {
  it('does not recycle a dialing task merely because the lease is old', async () => {
    const pacer = Object.create(AutodialPacerService.prototype) as AutodialPacerService;
    const update = jest.fn().mockResolvedValue([0]);
    pacer['taskModel'] = { update } as unknown as AutodialPacerService['taskModel'];
    await pacer['sweepStaleLeases']();
    expect(update).toHaveBeenCalledWith(
      { status: 'pending', leased_by: null, leased_at: null },
      { where: expect.objectContaining({ status: 'leased' }) },
    );
  });

  it('sums reservations across a tenant without counting another tenant', () => {
    const state = new AutodialStateService();
    state.reserve(7, 1, 1);
    state.reserve(7, 2, 2);
    state.reserve(8, 3, 4);
    expect(state.tenantReservedChannels(7)).toBe(3);
    expect(state.tenantReservedChannels(8)).toBe(4);
  });

  it('counts a READY operator only once across multiple campaign queues', () => {
    const pacer = Object.create(AutodialPacerService.prototype) as AutodialPacerService;
    pacer['ccState'] = {
      getAllAgents: jest.fn().mockReturnValue([
        { userId: 101, interface: 'PJSIP/101', status: 'READY', queues: ['sales', 'support'] },
        { userId: 101, interface: 'PJSIP/101-web', status: 'READY', queues: ['support'] },
        { userId: 102, interface: 'PJSIP/102', status: 'READY', queues: ['support'] },
        { userId: 103, interface: 'PJSIP/103', status: 'PAUSED', queues: ['sales'] },
        { userId: 104, interface: 'PJSIP/104', status: 'READY', queues: ['other'] },
      ]),
    } as unknown as AutodialPacerService['ccState'];

    expect(pacer['availableAgents']({
      user_uid: 7,
      queue_names: ['sales', 'support'],
      pacing: { providers: [{ type: 'queue_agents', queue_names: ['support'] }] },
    } as Parameters<AutodialPacerService['availableAgents']>[0])).toBe(2);
  });

  it('fails closed for a finite trunk when its occupancy snapshot is stale', () => {
    const pacer = Object.create(AutodialPacerService.prototype) as AutodialPacerService;
    pacer['trunkLimits'] = new Map([['trunk-1', 6]]);
    pacer['liveTrunkChannels'] = new Map([['trunk-1', 1]]);
    pacer['state'] = { trunkActiveChannels: () => 1 } as unknown as AutodialPacerService['state'];
    pacer['trunkPictureFresh'] = false;
    const campaign = { user_uid: 7, trunk_pool: [{ trunk_id: 'trunk-1', max_channels: 0 }] };
    expect(pacer['freeTrunkChannels'](campaign as Parameters<AutodialPacerService['freeTrunkChannels']>[0])).toBe(0);
    pacer['trunkPictureFresh'] = true;
    expect(pacer['freeTrunkChannels'](campaign as Parameters<AutodialPacerService['freeTrunkChannels']>[0])).toBe(5);
  });

  it('keeps an unlimited trunk available when a finite peer has a stale snapshot', () => {
    const pacer = Object.create(AutodialPacerService.prototype) as AutodialPacerService;
    pacer['trunkLimits'] = new Map([['finite', 2], ['unlimited', 0]]);
    pacer['liveTrunkChannels'] = new Map();
    pacer['state'] = { trunkActiveChannels: () => 0 } as unknown as AutodialPacerService['state'];
    pacer['trunkPictureFresh'] = false;
    const campaign = {
      user_uid: 7,
      trunk_pool: [{ trunk_id: 'finite', max_channels: 0 }, { trunk_id: 'unlimited', max_channels: 0 }],
    };

    expect(pacer['freeTrunkChannels'](campaign as Parameters<AutodialPacerService['freeTrunkChannels']>[0])).toBeNull();
    expect(
      pacer['availableTrunkIds'](
        campaign as Parameters<AutodialPacerService['availableTrunkIds']>[0],
      ),
    ).toEqual(new Set(['unlimited']));
  });

  it('does not lease when a campaign has only disabled schedule rows', async () => {
    const pacer = Object.create(AutodialPacerService.prototype) as AutodialPacerService;
    const setPacing = jest.fn();
    const leaseTasks = jest.fn();
    pacer['state'] = { setPacing } as unknown as AutodialPacerService['state'];
    pacer['leaseTasks'] = leaseTasks;

    await pacer['paceCampaign'](
      { uid: 9, user_uid: 7, status: 'running' } as Parameters<AutodialPacerService['paceCampaign']>[0],
      [disabledSchedule()],
      new Date('2026-09-18T12:00:00Z'),
      false,
    );

    expect(leaseTasks).not.toHaveBeenCalled();
    expect(setPacing).toHaveBeenCalledWith(7, 9, {
      capacity: 0,
      limitedBy: 'schedule',
      status: 'running',
    });
  });

  it('keeps disabled rows when loading campaign schedules', async () => {
    const pacer = Object.create(AutodialPacerService.prototype) as AutodialPacerService;
    const row = disabledSchedule();
    const findAll = jest.fn().mockResolvedValue([row]);
    pacer['scheduleModel'] = { findAll } as unknown as AutodialPacerService['scheduleModel'];

    const schedules = await pacer['schedulesByCampaign']([9]);

    expect(findAll).toHaveBeenCalledWith({
      where: { campaign_uid: expect.anything() },
    });
    expect(schedules.get(9)).toEqual([row]);
  });
});
