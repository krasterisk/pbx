import { EndpointsService, NAT_ENDPOINT_DEFAULTS, WEBRTC_ENDPOINT_DEFAULTS } from './endpoints.service';

function makeService() {
  const created: Record<string, unknown>[] = [];
  const endpointModel = {
    create: jest.fn().mockImplementation(async (row: Record<string, unknown>) => {
      created.push(row);
      return row;
    }),
    destroy: jest.fn().mockResolvedValue(1),
    findByPk: jest.fn().mockResolvedValue(null),
  };
  const authModel = {
    create: jest.fn().mockResolvedValue({}),
    destroy: jest.fn().mockResolvedValue(1),
  };
  const aorModel = {
    create: jest.fn().mockResolvedValue({}),
    destroy: jest.fn().mockResolvedValue(1),
  };
  const contactModel = {
    destroy: jest.fn().mockResolvedValue(1),
  };
  const service = new EndpointsService(
    endpointModel as any,
    authModel as any,
    aorModel as any,
    contactModel as any,
    {} as any,
    {} as any,
    {} as any,
    {},
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
