import { Op } from 'sequelize';
import { EndpointsService, NAT_ENDPOINT_DEFAULTS, WEBRTC_ENDPOINT_DEFAULTS } from './endpoints.service';

function makeService() {
  const created: Record<string, unknown>[] = [];
  const endpointModel = {
    findOne: jest.fn(),
    update: jest.fn().mockResolvedValue([1]),
    create: jest.fn().mockImplementation(async (row: Record<string, unknown>) => {
      created.push(row);
      return row;
    }),
    destroy: jest.fn().mockResolvedValue(1),
    findByPk: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue([]),
  };
  const authModel = {
    findAll: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({}),
    destroy: jest.fn().mockResolvedValue(1),
  };
  const aorModel = {
    findAll: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({}),
    destroy: jest.fn().mockResolvedValue(1),
  };
  const contactModel = {
    findAll: jest.fn().mockResolvedValue([]),
    destroy: jest.fn().mockResolvedValue(1),
  };
  const service = new EndpointsService(
    endpointModel as any,
    authModel as any,
    aorModel as any,
    contactModel as any,
    { transaction: async (callback: (t: object) => Promise<unknown>) => callback({}) } as any,
    {} as any,
    {} as any,
    {},
    { sync: jest.fn().mockResolvedValue(true) } as any,
  );
  return { service, endpointModel, authModel, aorModel, contactModel, created };
}

describe('EndpointsService ephemeral guest API (16.1-01)', () => {
  it('createEphemeralGuestEndpoint writes vp8 allow and the given max_video_streams', async () => {
    const { service, endpointModel, authModel, aorModel, created } = makeService();

    await service.createEphemeralGuestEndpoint({
      sipId: 'gstdeadbeef',
      password: 'secret',
      context: 'krsk-conf-77',
      vpbx: 42,
      maxVideoStreams: 8,
    });

    expect(authModel.create).toHaveBeenCalledWith({
      id: 'gstdeadbeef',
      auth_type: 'userpass',
      username: 'gstdeadbeef',
      password: 'secret',
    });
    expect(aorModel.create).toHaveBeenCalledWith({
      id: 'gstdeadbeef',
      max_contacts: 1,
      qualify_frequency: 60,
      remove_existing: 'yes',
    });
    expect(endpointModel.create).toHaveBeenCalledTimes(1);
    const row = created[0];
    expect(row.id).toBe('gstdeadbeef');
    expect(row.tenantid).toBe('42');
    expect(row.context).toBe('krsk-conf-77');
    expect(String(row.allow)).toContain('vp8');
    expect(row.max_video_streams).toBe(8);
    expect(row.transport).toBe('transport-wss');
  });

  it('destroyEphemeralGuestEndpoint filters the endpoint by id and tenantid', async () => {
    const { service, endpointModel, authModel, aorModel, contactModel } = makeService();
    const remove = jest.spyOn(service, 'remove').mockResolvedValue(undefined as never);

    await service.destroyEphemeralGuestEndpoint('gstdeadbeef', 42);

    expect(contactModel.destroy).toHaveBeenCalledWith({ where: { endpoint: 'gstdeadbeef' } });
    expect(endpointModel.destroy).toHaveBeenCalledWith({
      where: { id: 'gstdeadbeef', tenantid: '42' },
    });
    expect(authModel.destroy).toHaveBeenCalledWith({ where: { id: 'gstdeadbeef' } });
    expect(aorModel.destroy).toHaveBeenCalledWith({ where: { id: 'gstdeadbeef' } });
    expect(remove).not.toHaveBeenCalled();
    remove.mockRestore();
  });
});

describe('Subscriber API ownership and BLF policy', () => {
  it('hides trunks, guests and companions in the subscriber list', async () => {
    const { service, endpointModel } = makeService();
    endpointModel.findAll.mockResolvedValue(['e201_0', 'ew201_0', 't_komandor_0', 'gst123', 'e201_7'].map((id) => ({
      id, toJSON: () => ({ id, allow_subscribe: 'yes' }),
    })));
    expect((await service.findAll(0)).map((r) => r.id)).toEqual(['e201_0']);
  });

  it('cannot read, edit, delete or disclose credentials of a trunk via subscriber API', async () => {
    const { service, endpointModel } = makeService();
    await expect(service.findOne('t_komandor_0', 0)).rejects.toThrow('Not a primary subscriber');
    await expect(service.update('t_komandor_0', {}, 0)).rejects.toThrow('Not a primary subscriber');
    await expect(service.remove('t_komandor_0', 0)).rejects.toThrow('Not a primary subscriber');
    await expect(service.getCredentials('t_komandor_0', 0)).rejects.toThrow('Not a subscriber');
    expect(endpointModel.destroy).not.toHaveBeenCalled();
  });

  it('overrides foreign subscription context and ownership changes while disabling BLF', async () => {
    const { service, endpointModel } = makeService();
    endpointModel.findOne.mockResolvedValue({ id: 'e201_42', allow_subscribe: 'yes' });
    jest.spyOn(service, 'findOne').mockResolvedValue({} as any);
    await service.update('e201_42', { endpoint: {
      blf_enabled: false, subscribe_context: 'krsk-blf-7', tenantid: '7', id: 't_komandor_42',
    } }, 42);
    expect(endpointModel.update).toHaveBeenCalledWith(
      { allow_subscribe: 'no', subscribe_context: 'krsk-blf-42' },
      expect.objectContaining({ where: { id: 'e201_42' } }),
    );
  });
});

describe('EndpointsService WebRTC profile and companion allow (16.1-03)', () => {
  it('WEBRTC_ENDPOINT_DEFAULTS carries max_video_streams 16', () => {
    expect(WEBRTC_ENDPOINT_DEFAULTS.max_video_streams).toBe(16);
  });

  it('NAT_ENDPOINT_DEFAULTS has no webrtc or max_video_streams fields', () => {
    expect(NAT_ENDPOINT_DEFAULTS).not.toHaveProperty('webrtc');
    expect(NAT_ENDPOINT_DEFAULTS).not.toHaveProperty('max_video_streams');
    expect(NAT_ENDPOINT_DEFAULTS.ice_support).toBe('yes');
  });

  it('createCompanionTriple without primary.allow writes opus,ulaw,vp8 and 16 streams', async () => {
    const { service, created } = makeService();

    await (service as any).createCompanionTriple(
      1,
      '100',
      { context: 'from-internal1', callerid: '"100" <100>' },
      {},
    );

    const row = created.find((r) => r.id === 'ew100_1');
    expect(row).toBeDefined();
    expect(row!.allow).toBe('opus,ulaw,vp8');
    expect(row!.max_video_streams).toBe(16);
  });

  it('createCompanionTriple keeps an explicit primary.allow', async () => {
    const { service, created } = makeService();

    await (service as any).createCompanionTriple(
      1,
      '100',
      { context: 'from-internal1', callerid: '"100" <100>', allow: 'ulaw,alaw' },
      {},
    );

    const row = created.find((r) => r.id === 'ew100_1');
    expect(row).toBeDefined();
    expect(row!.allow).toBe('ulaw,alaw');
  });

  it('createCompanionTriple returns existing ew id without a second INSERT', async () => {
    const { service, endpointModel, created } = makeService();
    endpointModel.findByPk.mockResolvedValue({ id: 'ew100_1' });

    const id = await (service as any).createCompanionTriple(
      1,
      '100',
      { context: 'from-internal1', callerid: '"100" <100>' },
      {},
    );

    expect(id).toBe('ew100_1');
    expect(endpointModel.create).not.toHaveBeenCalled();
    expect(created).toHaveLength(0);
  });
});

describe('EndpointsService.backfillWebrtcVideo (16.1-03)', () => {
  it('raises ew* max_video_streams to 16 and appends vp8', async () => {
    const companion = {
      id: 'ew100_1',
      max_video_streams: 1,
      allow: 'ulaw,opus',
      update: jest.fn().mockImplementation(async (patch: Record<string, unknown>) => {
        Object.assign(companion, patch);
      }),
    };
    const { service, endpointModel } = makeService();
    endpointModel.findAll.mockResolvedValue([companion]);

    await service.backfillWebrtcVideo();

    expect(endpointModel.findAll).toHaveBeenCalledWith({
      where: { id: { [Op.like]: 'ew%' } },
    });
    expect(companion.update).toHaveBeenCalled();
    expect(companion.max_video_streams).toBe(16);
    expect(String(companion.allow).toLowerCase()).toContain('vp8');
  });

  it('does not change primary e* rows', async () => {
    const primary = {
      id: 'e100_1',
      max_video_streams: 1,
      allow: 'ulaw,alaw',
      update: jest.fn(),
    };
    const { service, endpointModel } = makeService();
    endpointModel.findAll.mockResolvedValue([]);

    await service.backfillWebrtcVideo();

    expect(endpointModel.findAll).toHaveBeenCalledWith({
      where: { id: { [Op.like]: 'ew%' } },
    });
    expect(primary.update).not.toHaveBeenCalled();
  });

  it('is idempotent when vp8 and 16 are already set', async () => {
    const companion = {
      id: 'ew100_1',
      max_video_streams: 16,
      allow: 'opus,ulaw,vp8',
      update: jest.fn(),
    };
    const { service, endpointModel } = makeService();
    endpointModel.findAll.mockResolvedValue([companion]);

    await service.backfillWebrtcVideo();

    expect(companion.update).not.toHaveBeenCalled();
  });
});
