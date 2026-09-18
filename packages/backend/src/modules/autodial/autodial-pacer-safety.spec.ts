import { AutodialPacerService } from './autodial-pacer.service';
import { AutodialStateService } from './autodial-state.service';

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
});
