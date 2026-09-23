import { AutodialReservationService } from './autodial-reservation.service';

describe('AutodialReservationService', () => {
  it('counts open holds per tenant and trunk', async () => {
    const service = Object.create(
      AutodialReservationService.prototype,
    ) as AutodialReservationService;
    service['model'] = {
      findAll: jest.fn().mockResolvedValue([
        { user_uid: 7, trunk_id: 't1' },
        { user_uid: 7, trunk_id: 't1' },
        { user_uid: 7, trunk_id: 't2' },
        { user_uid: 8, trunk_id: 't1' },
      ]),
    } as unknown as AutodialReservationService['model'];

    const counts = await service.countOpenByTrunk(new Date('2026-09-21T12:00:00Z'));
    expect(counts.get('7:t1')).toBe(2);
    expect(counts.get('7:t2')).toBe(1);
    expect(counts.get('8:t1')).toBe(1);
  });

  it('returns false when a duplicate task reservation is rejected', async () => {
    const service = Object.create(
      AutodialReservationService.prototype,
    ) as AutodialReservationService;
    service['logger'] = { warn: jest.fn() } as unknown as AutodialReservationService['logger'];
    service['model'] = {
      create: jest.fn().mockRejectedValue(new Error('Duplicate entry')),
    } as unknown as AutodialReservationService['model'];

    await expect(
      service.reserve({
        userUid: 7,
        campaignUid: 1,
        taskUid: 22,
        trunkId: 't1',
        owner: 'pacer-a',
      }),
    ).resolves.toBe(false);
  });
});
