import { DiagnosticsService } from './diagnostics.service';

describe('tenant registration diagnostics', () => {
  const ami = { pjsipShowEndpoint: jest.fn() };
  const endpoints = { findAll: jest.fn() };
  const service = new DiagnosticsService(ami as any, {} as any, endpoints as any, {} as any);
  beforeEach(() => jest.resetAllMocks());

  it('never queries a foreign endpoint or accepts a CLI fragment', async () => {
    endpoints.findAll.mockResolvedValue([{ id: 'e101_43' }]);
    expect(await service.readEndpointRegistration(42, '101')).toMatchObject({ exists: false });
    await expect(service.readEndpointRegistration(42, '101;restart')).rejects.toThrow();
    expect(ami.pjsipShowEndpoint).not.toHaveBeenCalled();
  });

  it('returns operational evidence without credentials or contact addresses', async () => {
    endpoints.findAll.mockResolvedValue([{ id: 'e101_42' }]);
    ami.pjsipShowEndpoint.mockResolvedValue({ events: [
      { event: 'AuthDetail', password: 'secret' },
      { event: 'EndpointDetail', devicestate: 'Unavailable', password: 'secret', uri: 'sip:private' },
    ] });
    const result = await service.readEndpointRegistration(42, '101');
    expect(ami.pjsipShowEndpoint).toHaveBeenCalledWith('e101_42');
    expect(result.states).toEqual([{ event: 'EndpointDetail', deviceState: 'Unavailable', contactStatus: '', roundtripUsec: '' }]);
    expect(JSON.stringify(result)).not.toMatch(/secret|private|AuthDetail/);
  });
});
