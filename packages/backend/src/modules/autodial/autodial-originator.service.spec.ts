import { AutodialOriginatorService } from './autodial-originator.service';

describe('AutodialOriginatorService', () => {
  it('completes a leased task as DNC before creating an attempt or ARI channel', async () => {
    const originator = Object.create(
      AutodialOriginatorService.prototype,
    ) as AutodialOriginatorService;
    const findOne = jest.fn().mockResolvedValue({ normalized: '79991234567' });
    const isBlocked = jest.fn().mockResolvedValue(true);
    const originateChannel = jest.fn();
    originator['phoneModel'] = { findOne } as unknown as AutodialOriginatorService['phoneModel'];
    originator['dnc'] = { isBlocked } as unknown as AutodialOriginatorService['dnc'];
    originator['ari'] = { originateChannel } as unknown as AutodialOriginatorService['ari'];
    originator['logger'] = { warn: jest.fn() } as unknown as AutodialOriginatorService['logger'];

    const update = jest.fn().mockResolvedValue(undefined);
    const task = { uid: 22, phone_uid: 33, update };
    const campaign = { uid: 11, user_uid: 7, base_uid: 8 };

    await expect(
      originator.originate(
        task as Parameters<AutodialOriginatorService['originate']>[0],
        campaign as Parameters<AutodialOriginatorService['originate']>[1],
      ),
    ).resolves.toBe(false);

    expect(isBlocked).toHaveBeenCalledWith(7, '79991234567', {
      campaignUid: 11,
      baseUid: 8,
    });
    expect(update).toHaveBeenCalledWith({
      status: 'completed',
      last_disposition: 'dnc',
      last_cause: 'blocked by dnc',
      leased_by: null,
      leased_at: null,
    });
    expect(originateChannel).not.toHaveBeenCalled();
  });

  it('starts the scenario only after Up and only once for duplicate ARI events', async () => {
    const originator = Object.create(
      AutodialOriginatorService.prototype,
    ) as AutodialOriginatorService;
    const markAnswered = jest.fn();
    const continueInDialplan = jest.fn().mockResolvedValue(undefined);
    originator['state'] = { markAnswered } as unknown as AutodialOriginatorService['state'];
    originator['attempts'] = { markAnswered: jest.fn().mockResolvedValue(undefined) } as unknown as AutodialOriginatorService['attempts'];
    originator['ari'] = { continueInDialplan } as unknown as AutodialOriginatorService['ari'];
    originator['handedOffChannels'] = new Set<string>();
    originator['logger'] = { error: jest.fn() } as unknown as AutodialOriginatorService['logger'];

    const channel = 'ac-11-22-1';
    await originator.onStasisStart({ channel: { id: channel, state: 'Down' } });
    expect(markAnswered).not.toHaveBeenCalled();
    expect(continueInDialplan).not.toHaveBeenCalled();

    await originator.onChannelStateChange({ channel: { id: channel, state: 'Up' } });
    await originator.onStasisStart({ channel: { id: channel, state: 'Up' } });

    expect(markAnswered).toHaveBeenCalledTimes(1);
    expect(originator['attempts'].markAnswered).toHaveBeenCalledTimes(1);
    expect(continueInDialplan).toHaveBeenCalledTimes(1);
    expect(continueInDialplan).toHaveBeenCalledWith(
      channel,
      'krsk-ac-11',
      's',
      1,
    );
  });

  it('finalizes a destroyed channel from persisted correlation after a worker restart', async () => {
    const originator = Object.create(
      AutodialOriginatorService.prototype,
    ) as AutodialOriginatorService;
    const answeredAt = new Date(Date.now() - 20_000);
    const findOpenByChannelId = jest.fn().mockResolvedValue({
      uid: 44, campaign_uid: 11, answered_at: answeredAt,
    });
    const finalize = jest.fn().mockResolvedValue(undefined);
    originator['attempts'] = { findOpenByChannelId, finalize } as unknown as AutodialOriginatorService['attempts'];
    originator['attemptByChannel'] = new Map<string, number>();
    originator['handedOffChannels'] = new Set<string>();
    originator['state'] = {
      getChannel: jest.fn().mockReturnValue(undefined),
      removeChannel: jest.fn(),
    } as unknown as AutodialOriginatorService['state'];
    originator['campaignModel'] = {
      findByPk: jest.fn().mockResolvedValue({ success_min_sec: 15 }),
    } as unknown as AutodialOriginatorService['campaignModel'];

    await originator.onChannelDestroyed({ channel: { id: 'ac-11-22-1' }, cause: 16 });

    expect(findOpenByChannelId).toHaveBeenCalledWith('ac-11-22-1');
    expect(finalize).toHaveBeenCalledWith(expect.objectContaining({
      attemptUid: 44,
      disposition: 'success',
      answeredAt,
    }));
  });

  it('registers correlation before ARI originate and sends CallerID as an originate parameter', async () => {
    const originator = Object.create(
      AutodialOriginatorService.prototype,
    ) as AutodialOriginatorService;
    const addChannel = jest.fn();
    const openAttempt = jest.fn().mockResolvedValue({ uid: 44 });
    const originateChannel = jest.fn(async (params) => {
      expect(originator.attemptUidFor(params.channelId)).toBe(44);
      expect(addChannel).toHaveBeenCalled();
    });
    originator['phoneModel'] = {
      findOne: jest.fn().mockResolvedValue({ normalized: '79991234567' }),
    } as unknown as AutodialOriginatorService['phoneModel'];
    originator['contactModel'] = {
      findOne: jest.fn().mockResolvedValue(null),
    } as unknown as AutodialOriginatorService['contactModel'];
    originator['fieldModel'] = {
      findAll: jest.fn().mockResolvedValue([]),
    } as unknown as AutodialOriginatorService['fieldModel'];
    originator['dnc'] = { isBlocked: jest.fn().mockResolvedValue(false) } as unknown as AutodialOriginatorService['dnc'];
    originator['attempts'] = { openAttempt } as unknown as AutodialOriginatorService['attempts'];
    originator['state'] = { addChannel } as unknown as AutodialOriginatorService['state'];
    originator['ari'] = {
      getAutodialAppName: () => 'krasterisk_autodial',
      originateChannel,
      dialChannel: jest.fn().mockResolvedValue(undefined),
    } as unknown as AutodialOriginatorService['ari'];
    originator['attemptByChannel'] = new Map<string, number>();

    const task = { uid: 22, phone_uid: 33, attempt_count: 0, update: jest.fn() };
    await originator.originate(
      task as Parameters<AutodialOriginatorService['originate']>[0],
      {
        uid: 11,
        user_uid: 7,
        base_uid: 8,
        trunk_pool: [
          { trunk_id: 'saturated', caller_id: '79990000000' },
          { trunk_id: 'trunk-1', caller_id: '70000000000' },
        ],
        cid_policy: { mode: 'per_trunk' },
        dial_timeout_sec: 30,
      } as Parameters<AutodialOriginatorService['originate']>[1],
      new Set(['trunk-1']),
    );

    const createParams = originateChannel.mock.calls[0][0];
    expect(createParams.callerId).toBe('70000000000');
    expect(createParams.app).toBe('krasterisk_autodial');
    expect(createParams.appArgs).toBe('autodial-v1,11,22');
    expect(createParams.variables).not.toHaveProperty('CALLERID(num)');
    expect(createParams.endpoint).toBe('PJSIP/79991234567@trunk-1');
  });

  it('does not originate when the lease was reassigned before the ARI handoff', async () => {
    const originator = Object.create(AutodialOriginatorService.prototype) as AutodialOriginatorService;
    originator['phoneModel'] = { findOne: jest.fn().mockResolvedValue({ normalized: '79991234567' }) } as unknown as AutodialOriginatorService['phoneModel'];
    originator['contactModel'] = { findOne: jest.fn().mockResolvedValue(null) } as unknown as AutodialOriginatorService['contactModel'];
    originator['fieldModel'] = { findAll: jest.fn().mockResolvedValue([]) } as unknown as AutodialOriginatorService['fieldModel'];
    originator['dnc'] = { isBlocked: jest.fn().mockResolvedValue(false) } as unknown as AutodialOriginatorService['dnc'];
    const openAttempt = jest.fn();
    originator['attempts'] = { openAttempt } as unknown as AutodialOriginatorService['attempts'];
    originator['ari'] = { originateChannel: jest.fn() } as unknown as AutodialOriginatorService['ari'];

    await expect(originator.originate(
      { uid: 22, phone_uid: 33, attempt_count: 0, leased_by: 'pacer-a' } as Parameters<AutodialOriginatorService['originate']>[0],
      { uid: 11, user_uid: 7, base_uid: 8, trunk_pool: [{ trunk_id: 'trunk-1' }], cid_policy: { mode: 'per_trunk' } } as Parameters<AutodialOriginatorService['originate']>[1],
      undefined,
      'pacer-b',
    )).resolves.toBe(false);

    expect(openAttempt).not.toHaveBeenCalled();
    expect(originator['ari'].originateChannel).not.toHaveBeenCalled();
  });

  it('resolves a per-trunk Caller ID from the directory by an explicit contact field', async () => {
    const originator = Object.create(
      AutodialOriginatorService.prototype,
    ) as AutodialOriginatorService;
    const originateChannel = jest.fn().mockResolvedValue(undefined);
    originator['phoneModel'] = {
      findOne: jest.fn().mockResolvedValue({ normalized: '79991234567' }),
    } as unknown as AutodialOriginatorService['phoneModel'];
    originator['contactModel'] = {
      findOne: jest.fn().mockResolvedValue({ values: { region: 'siberia' } }),
    } as unknown as AutodialOriginatorService['contactModel'];
    originator['fieldModel'] = {
      findAll: jest.fn().mockResolvedValue([]),
    } as unknown as AutodialOriginatorService['fieldModel'];
    originator['dnc'] = { isBlocked: jest.fn().mockResolvedValue(false) } as unknown as AutodialOriginatorService['dnc'];
    originator['directories'] = {
      lookup: jest.fn().mockResolvedValue({ status: 'FOUND', values: ['74951112233'] }),
    } as unknown as AutodialOriginatorService['directories'];
    originator['attempts'] = { openAttempt: jest.fn().mockResolvedValue({ uid: 44 }) } as unknown as AutodialOriginatorService['attempts'];
    originator['state'] = { addChannel: jest.fn() } as unknown as AutodialOriginatorService['state'];
    originator['ari'] = {
      getAutodialAppName: () => 'krasterisk_autodial',
      originateChannel,
      dialChannel: jest.fn().mockResolvedValue(undefined),
    } as unknown as AutodialOriginatorService['ari'];
    originator['attemptByChannel'] = new Map<string, number>();

    await originator.originate(
      { uid: 22, phone_uid: 33, attempt_count: 0, update: jest.fn() } as Parameters<AutodialOriginatorService['originate']>[0],
      {
        uid: 11,
        user_uid: 7,
        base_uid: 8,
        trunk_pool: [{
          trunk_id: 'trunk-1',
          caller_id: '74950000000',
          caller_id_source: {
            mode: 'directory',
            directory_uid: 5,
            value_field_uid: 17,
            key: { source: 'autodial_field', field_key: 'region' },
            on_missing: 'fallback',
          },
        }],
        cid_policy: { mode: 'per_trunk' },
        dial_timeout_sec: 30,
      } as Parameters<AutodialOriginatorService['originate']>[1],
    );

    expect(originator['directories'].lookup).toHaveBeenCalledWith({
      directoryUid: 5,
      userUid: 7,
      key: 'siberia',
      fieldUids: [17],
    });
    expect(originateChannel.mock.calls[0][0].callerId).toBe('74951112233');
  });
});
