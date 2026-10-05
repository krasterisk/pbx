import { TrunksService } from './trunks.service';

function fixture(connected = true) {
  const endpoints = { findAll: jest.fn().mockResolvedValue([{ id: 't_komandor_7', tenantid: '7', context: 'from-trunk7' }, { id: 'e201_7', tenantid: '7' }]) };
  const related = { findAll: jest.fn().mockResolvedValue([]) };
  const ami = {
    isConnected: jest.fn(() => connected),
    pjsipShowRegistrations: jest.fn().mockResolvedValue({ events: [] }),
    command: jest.fn().mockResolvedValue({ response: 'Success' }),
    pjsipShowEndpoint: jest.fn().mockResolvedValue({ events: [{ event: 'ContactStatusDetail', status: 'Reachable' }] }),
  };
  const service = new TrunksService(endpoints as never, related as never, related as never, related as never, related as never, {} as never, ami as never, {} as never);
  return { service, endpoints, ami };
}

describe('trunk list live status', () => {
  it('synchronizes qualify for a single safe endpoint argument', async () => {
    const { service, ami } = fixture();
    await service['syncQualify']('t_komandor_7');
    expect(ami.command).toHaveBeenCalledWith('pjsip reload qualify endpoint t_komandor_7');
    await expect(service['syncQualify']('t_komandor_7\ncore stop now')).rejects.toThrow('Invalid endpoint identifier');
    expect(ami.command).toHaveBeenCalledTimes(1);
  });
  it('queries only tenant-owned trunk endpoints and keeps registration separate for IP trunks', async () => {
    const { service, endpoints, ami } = fixture();
    const rows = await service.findAll(7);
    expect(endpoints.findAll).toHaveBeenCalledWith({ where: { tenantid: '7' }, order: [['id', 'ASC']] });
    expect(ami.pjsipShowRegistrations).not.toHaveBeenCalled();
    expect(ami.pjsipShowEndpoint).toHaveBeenCalledTimes(1);
    expect(ami.pjsipShowEndpoint).toHaveBeenCalledWith('t_komandor_7');
    expect(rows[0]).toMatchObject({ trunkType: 'ip', registrationStatus: null, reachabilityStatus: 'Reachable' });
  });
  it('uses Unknown instead of reporting a failed AMI query as unavailable', async () => {
    const { service, ami } = fixture();
    ami.pjsipShowEndpoint.mockRejectedValue(new Error('AMI timeout'));
    expect((await service.findAll(7))[0].reachabilityStatus).toBe('Unknown');
  });
  it('does not probe when AMI is disconnected', async () => {
    const { service, ami } = fixture(false);
    expect((await service.findAll(7))[0].reachabilityStatus).toBe('Unknown');
    expect(ami.pjsipShowEndpoint).not.toHaveBeenCalled();
  });
});
