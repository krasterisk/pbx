import { AutodialAttemptService } from './autodial-attempt.service';

describe('AutodialAttemptService', () => {
  function serviceWith(updateResults: number[]) {
    const service = Object.create(
      AutodialAttemptService.prototype,
    ) as AutodialAttemptService;
    const attempt = {
      uid: 41,
      disposition: 'dialing',
      task_uid: 22,
      campaign_uid: 11,
      started_at: new Date('2026-09-18T10:00:00Z'),
      answered_at: null,
      talk_sec: 17,
      agent_interface: 'PJSIP/100',
      amd_result: null,
    };
    const update = jest.fn();
    updateResults.forEach((count) => update.mockResolvedValueOnce([count]));
    service['attemptModel'] = {
      findByPk: jest.fn().mockResolvedValue(attempt),
      update,
    } as unknown as AutodialAttemptService['attemptModel'];
    service['state'] = {
      recordAnsweredOutcome: jest.fn(),
    } as unknown as AutodialAttemptService['state'];
    service['advanceTask'] = jest.fn().mockResolvedValue(undefined);
    return { service, update };
  }

  it('advances a task only for the single winner of competing finalizers', async () => {
    const { service, update } = serviceWith([1, 0]);

    await Promise.all([
      service.finalize({ attemptUid: 41, disposition: 'busy' }),
      service.finalize({ attemptUid: 41, disposition: 'busy' }),
    ]);

    expect(update).toHaveBeenCalledTimes(2);
    expect(service['advanceTask']).toHaveBeenCalledTimes(1);
  });

  it('does not erase post-answer enrichment that the final event did not provide', async () => {
    const { service, update } = serviceWith([1]);

    await service.finalize({ attemptUid: 41, disposition: 'success', billsec: 30 });

    const patch = update.mock.calls[0][0];
    expect(patch).not.toHaveProperty('agent_interface');
    expect(patch).not.toHaveProperty('talk_sec');
    expect(patch.billsec).toBe(30);
  });

  it('retains a machine classification written before ARI finalizes the channel', async () => {
    const { service, update } = serviceWith([1]);
    const attempt = await service['attemptModel'].findByPk(41);
    attempt.amd_result = 'MACHINE';

    await service.finalize({ attemptUid: 41, disposition: 'success' });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ disposition: 'amd_machine' }),
      { where: { uid: 41, disposition: 'dialing' } },
    );
    expect(service['advanceTask']).toHaveBeenCalledWith(22, 'amd_machine', null);
  });

  it('marks only an attempt that has not already reached a terminal state', async () => {
    const { service, update } = serviceWith([1]);

    await service.markAmdMachine(41);

    expect(update).toHaveBeenCalledWith(
      { amd_result: 'MACHINE' },
      { where: { uid: 41, disposition: 'dialing' } },
    );
  });

  it('stores answer evidence once for restart recovery', async () => {
    const { service, update } = serviceWith([1]);
    const answeredAt = new Date('2026-09-18T10:00:20Z');

    await service.markAnswered('ac-11-22-1', answeredAt);

    expect(update).toHaveBeenCalledWith(
      { answered_at: answeredAt },
      { where: { channel_id: 'ac-11-22-1', disposition: 'dialing', answered_at: null } },
    );
  });

  it('opens an attempt only when the same worker atomically still owns the lease', async () => {
    const service = Object.create(AutodialAttemptService.prototype) as AutodialAttemptService;
    const transaction = { id: 'tx' };
    const taskUpdate = jest.fn().mockResolvedValue([1]);
    const create = jest.fn().mockResolvedValue({ uid: 88 });
    service['taskModel'] = {
      sequelize: { transaction: (work: (tx: unknown) => unknown) => work(transaction) },
      update: taskUpdate,
    } as unknown as AutodialAttemptService['taskModel'];
    service['attemptModel'] = { create } as unknown as AutodialAttemptService['attemptModel'];

    await expect(service.claimAndOpenAttempt({
      userUid: 7, taskUid: 22, campaignUid: 11, attemptNo: 1,
      channelId: 'ac-11-22-1', trunkId: 'trunk-1', callerId: '74950000000', leaseId: 'pacer-a',
    })).resolves.toEqual({ uid: 88 });

    expect(taskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'dialing', attempt_count: 1 }),
      expect.objectContaining({
        where: { uid: 22, user_uid: 7, status: 'leased', leased_by: 'pacer-a' },
        transaction,
      }),
    );
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ task_uid: 22 }), { transaction });
  });

  it('does not create an attempt after a worker loses its lease', async () => {
    const service = Object.create(AutodialAttemptService.prototype) as AutodialAttemptService;
    const create = jest.fn();
    service['taskModel'] = {
      sequelize: { transaction: (work: (tx: unknown) => unknown) => work({ id: 'tx' }) },
      update: jest.fn().mockResolvedValue([0]),
    } as unknown as AutodialAttemptService['taskModel'];
    service['attemptModel'] = { create } as unknown as AutodialAttemptService['attemptModel'];

    await expect(service.claimAndOpenAttempt({
      userUid: 7, taskUid: 22, campaignUid: 11, attemptNo: 1,
      channelId: 'ac-11-22-1', trunkId: 'trunk-1', callerId: null, leaseId: 'pacer-a',
    })).resolves.toBeNull();

    expect(create).not.toHaveBeenCalled();
  });
});
