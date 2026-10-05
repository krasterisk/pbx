import { BlfService } from './blf.service';

describe('BLF reconciliation', () => {
  function setup() {
    const row = { id: 'e201_42', allow_subscribe: 'yes', subscribe_context: 'foreign', update: jest.fn().mockImplementation(async (patch) => Object.assign(row, patch)) };
    const endpoints = { findAll: jest.fn().mockResolvedValue([row]) };
    const dialplan = { applyCategories: jest.fn().mockResolvedValue({ success: true }) };
    return { row, endpoints, dialplan, service: new BlfService(endpoints as any, dialplan as any) };
  }

  it('scopes reads and lookup context, writes only hints, skips unchanged and clears deletion', async () => {
    const { row, endpoints, dialplan, service } = setup();
    expect(await service.sync(42)).toBe(true);
    expect(endpoints.findAll).toHaveBeenCalledWith({ where: { tenantid: '42' } });
    expect(row.update).toHaveBeenCalledWith({ allow_subscribe: 'yes', subscribe_context: 'krsk-blf-42' });
    expect(dialplan.applyCategories).toHaveBeenCalledWith('krasterisk/routes/blf_42.conf', [{ name: 'krsk-blf-42', lines: ['exten => 201,hint,PJSIP/e201_42'] }]);
    await service.sync(42);
    expect(dialplan.applyCategories).toHaveBeenCalledTimes(1);
    endpoints.findAll.mockResolvedValue([]);
    await service.sync(42);
    expect(dialplan.applyCategories).toHaveBeenLastCalledWith('krasterisk/routes/blf_42.conf', [{ name: 'krsk-blf-42', lines: [] }]);
  });

  it('retries failed applications and serializes concurrent mutations', async () => {
    const { endpoints, dialplan, service } = setup();
    dialplan.applyCategories.mockRejectedValueOnce(new Error('AMI disconnected'));
    expect(await service.sync(42)).toBe(false);
    expect(await service.sync(42)).toBe(true);
    let release!: () => void;
    endpoints.findAll.mockImplementationOnce(() => new Promise<any>((resolve) => { release = () => resolve([]); }));
    const first = service.sync(42);
    const second = service.sync(42);
    await Promise.resolve();
    const calls = endpoints.findAll.mock.calls.length;
    release();
    await Promise.all([first, second]);
    expect(endpoints.findAll.mock.calls.length).toBe(calls + 1);
  });
});
