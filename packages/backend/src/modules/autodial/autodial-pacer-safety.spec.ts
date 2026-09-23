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

  it('ignores campaign.queue_names when queue_agents is absent', () => {
    const pacer = Object.create(AutodialPacerService.prototype) as AutodialPacerService;
    pacer['ccState'] = {
      getAllAgents: jest.fn().mockReturnValue([
        { userId: 101, interface: 'PJSIP/101', status: 'READY', queues: ['sales'] },
      ]),
    } as unknown as AutodialPacerService['ccState'];

    expect(pacer['availableAgents']({
      user_uid: 7,
      queue_names: ['sales'],
      pacing: { providers: [{ type: 'static', max_channels: 5 }] },
    } as Parameters<AutodialPacerService['availableAgents']>[0])).toBe(0);
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
    pacer['claimCampaignOwner'] = jest.fn().mockResolvedValue(true);

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

  it('does not lease when saved revision is ahead of applied dialplan', async () => {
    const pacer = Object.create(AutodialPacerService.prototype) as AutodialPacerService;
    const setPacing = jest.fn();
    const leaseTasks = jest.fn();
    pacer['state'] = { setPacing } as unknown as AutodialPacerService['state'];
    pacer['leaseTasks'] = leaseTasks;
    pacer['claimCampaignOwner'] = jest.fn().mockResolvedValue(true);

    await pacer['paceCampaign'](
      {
        uid: 9,
        user_uid: 7,
        status: 'running',
        revision: 4,
        applied_revision: 3,
      } as Parameters<AutodialPacerService['paceCampaign']>[0],
      [],
      new Date('2026-09-18T12:00:00Z'),
      false,
    );

    expect(leaseTasks).not.toHaveBeenCalled();
    expect(setPacing).toHaveBeenCalledWith(7, 9, {
      capacity: 0,
      limitedBy: 'stale_apply',
      status: 'running',
    });
  });

  it('heartbeats this worker unstarted leases before each originate', async () => {
    const pacer = Object.create(AutodialPacerService.prototype) as AutodialPacerService;
    pacer['leaseId'] = 'pacer-test';
    const update = jest.fn().mockResolvedValue([1]);
    pacer['taskModel'] = { update } as unknown as AutodialPacerService['taskModel'];
    await pacer['heartbeatOwnLeases'](new Date('2026-09-18T12:00:00Z'));
    expect(update).toHaveBeenCalledWith(
      { leased_at: new Date('2026-09-18T12:00:00Z') },
      { where: { leased_by: 'pacer-test', status: 'leased' } },
    );
  });

  it('does not lease when another worker still owns the campaign', async () => {
    const pacer = Object.create(AutodialPacerService.prototype) as AutodialPacerService;
    const setPacing = jest.fn();
    const leaseTasks = jest.fn();
    pacer['state'] = { setPacing } as unknown as AutodialPacerService['state'];
    pacer['leaseTasks'] = leaseTasks;
    pacer['claimCampaignOwner'] = jest.fn().mockResolvedValue(false);

    await pacer['paceCampaign'](
      { uid: 9, user_uid: 7, status: 'running' } as Parameters<AutodialPacerService['paceCampaign']>[0],
      [],
      new Date('2026-09-18T12:00:00Z'),
      false,
    );

    expect(leaseTasks).not.toHaveBeenCalled();
    expect(setPacing).not.toHaveBeenCalled();
  });

  it('subtracts shared trunk reservations from remaining capacity', () => {
    const pacer = Object.create(AutodialPacerService.prototype) as AutodialPacerService;
    pacer['trunkLimits'] = new Map([['trunk-1', 6]]);
    pacer['liveTrunkChannels'] = new Map([['trunk-1', 1]]);
    pacer['state'] = { trunkActiveChannels: () => 1 } as unknown as AutodialPacerService['state'];
    pacer['trunkPictureFresh'] = true;
    pacer['trunkReservations'] = new Map([['7:trunk-1', 2]]);
    const campaign = { user_uid: 7, trunk_pool: [{ trunk_id: 'trunk-1', max_channels: 0 }] };
    expect(pacer['freeTrunkChannels'](campaign as Parameters<AutodialPacerService['freeTrunkChannels']>[0])).toBe(3);
  });

  it('returns a failed originate to pending so the next tick can retry', async () => {
    const pacer = Object.create(AutodialPacerService.prototype) as AutodialPacerService;
    pacer['leaseId'] = 'pacer-test';
    const update = jest.fn().mockResolvedValue([1]);
    pacer['taskModel'] = { update } as unknown as AutodialPacerService['taskModel'];
    pacer['state'] = {
      setPacing: jest.fn(),
      activeChannels: () => 0,
      reservedFor: () => 0,
      tenantActiveChannels: () => 0,
      tenantReservedChannels: () => 0,
      reserve: jest.fn(),
      release: jest.fn(),
    } as unknown as AutodialPacerService['state'];
    pacer['claimCampaignOwner'] = jest.fn().mockResolvedValue(true);
    pacer['dialplanIsCurrent'] = () => true;
    pacer['availableTrunkIds'] = () => new Set(['trunk-1']);
    pacer['freeTrunkChannels'] = () => 2;
    pacer['availableAgents'] = () => 0;
    pacer['overDialFor'] = () => undefined;
    pacer['leaseTasks'] = jest.fn().mockResolvedValue([{ uid: 22 }]);
    pacer['heartbeatOwnLeases'] = jest.fn().mockResolvedValue(undefined);
    pacer['reservations'] = { reserve: jest.fn(), release: jest.fn() } as unknown as AutodialPacerService['reservations'];
    pacer['originator'] = { originate: jest.fn().mockResolvedValue(false) } as unknown as AutodialPacerService['originator'];

    await pacer['paceCampaign'](
      {
        uid: 9,
        user_uid: 7,
        status: 'running',
        dial_mode: 'agentless',
        pacing: { providers: [{ type: 'static', max_channels: 2 }] },
        trunk_pool: [{ trunk_id: 'trunk-1', max_channels: 2 }],
      } as Parameters<AutodialPacerService['paceCampaign']>[0],
      [],
      new Date('2026-09-18T12:00:00Z'),
      false,
    );

    expect(update).toHaveBeenCalledWith(
      { status: 'pending', leased_by: null, leased_at: null },
      {
        where: {
          uid: 22,
          user_uid: 7,
          status: 'leased',
          leased_by: 'pacer-test',
        },
      },
    );
  });

  it('sweeps AMI-empty ghosts after a fresh trunk picture', async () => {
    const pacer = Object.create(AutodialPacerService.prototype) as AutodialPacerService;
    pacer['ticking'] = false;
    pacer['ariDown'] = false;
    pacer['startedAt'] = Date.now() - 60_000;
    pacer['trunkPictureFresh'] = false;
    const sweepAmiGhosts = jest.fn().mockResolvedValue(1);
    pacer['originator'] = { sweepAmiGhosts } as unknown as AutodialPacerService['originator'];
    pacer['sweepStaleLeases'] = jest.fn().mockResolvedValue(undefined);
    pacer['reservations'] = { sweepExpired: jest.fn().mockResolvedValue(undefined) } as unknown as AutodialPacerService['reservations'];
    pacer['ariConnection'] = { isConnected: () => true } as unknown as AutodialPacerService['ariConnection'];
    pacer['campaignModel'] = { findAll: jest.fn().mockResolvedValue([{ uid: 2 }]) } as unknown as AutodialPacerService['campaignModel'];
    pacer['refreshTrunkPicture'] = jest.fn().mockImplementation(async () => {
      pacer['trunkPictureFresh'] = true;
      pacer['liveTrunkChannels'] = new Map([['t_uat_ac_loop_20260921', 0]]);
    });
    pacer['schedulesByCampaign'] = jest.fn().mockResolvedValue(new Map());
    pacer['paceCampaign'] = jest.fn().mockResolvedValue(undefined);

    await pacer.tick();

    expect(sweepAmiGhosts).toHaveBeenCalledWith(pacer['liveTrunkChannels']);
    expect(pacer['paceCampaign']).toHaveBeenCalled();
  });
});
