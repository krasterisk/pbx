import { EndpointsService } from './endpoints.service';

function makeService() {
  const created: Record<string, unknown>[] = [];
  const endpointModel = {
    create: jest.fn().mockImplementation(async (row: Record<string, unknown>) => {
      created.push(row);
      return row;
    }),
    destroy: jest.fn().mockResolvedValue(1),
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
