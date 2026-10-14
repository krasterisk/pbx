import { EventEmitter } from 'events';
import { ConfigService } from '@nestjs/config';
import { AmiService } from '../ami/ami.service';
function setup(config: Record<string, unknown> = {}) {
  const manager = new EventEmitter() as EventEmitter & { action: jest.Mock };
  manager.action = jest.fn((_action, callback) => callback(null, { response: 'Success' }));
  const service = new AmiService(new ConfigService(config), {} as any, {} as any);
  (service as any).ami = manager; (service as any).connected = true;
  return { service, manager };
}
describe('Dashboard complete AMI bulk snapshots', () => {
  afterEach(() => jest.useRealTimers());
  it('requires the matching completion event, including for an empty result', async () => {
    const { service, manager } = setup();
    const promise = service.getActiveChannels();
    const id = manager.action.mock.calls[0][0].actionid;
    manager.emit('rawevent', { actionid: 'other', event: 'CoreShowChannel', uniqueid: 'foreign' });
    manager.emit('rawevent', { actionid: id, event: 'CoreShowChannelsComplete' });
    expect(await promise).toEqual({ complete: true, events: [] });
    expect(manager.listenerCount('rawevent')).toBe(0);
  });
  it('labels a partial timed-out list incomplete and cleans listeners', async () => {
    jest.useFakeTimers(); const { service, manager } = setup();
    const promise = service.getActiveChannels(); const id = manager.action.mock.calls[0][0].actionid;
    manager.emit('rawevent', { actionid: id, event: 'CoreShowChannel', uniqueid: 'one' });
    jest.advanceTimersByTime(15000);
    expect(await promise).toMatchObject({ complete: false, events: [{ uniqueid: 'one' }] });
    expect(manager.listenerCount('rawevent')).toBe(0);
  });
  it('labels a disconnect incomplete and accepts the manager Success-as-error workaround', async () => {
    const { service, manager } = setup();
    manager.action.mockImplementation((_a, callback) => callback({ response: 'Success' }));
    const promise = service.collectDashboardContacts(); manager.emit('close');
    expect(await promise).toEqual({ complete: false, events: [] });
    expect(manager.listenerCount('close')).toBe(0);
  });
  it('keeps internal observers separate and unsubscribes cleanly', () => {
    const { service } = setup(); const listener = jest.fn(); const unsubscribe = service.subscribeInternalEvents(listener);
    (service as any).publishInternal({ event: 'Hangup', uniqueid: 'one' }); unsubscribe();
    (service as any).publishInternal({ event: 'Hangup', uniqueid: 'two' });
    expect(listener).toHaveBeenCalledTimes(1);
  });
  it('accepts a complete inventory after the former 15-second deadline while channels retain their deadline', async () => {
    jest.useFakeTimers(); const { service, manager } = setup();
    const inventory = service.collectDashboardEndpoints(); const id = manager.action.mock.calls[0][0].actionid;
    const settled = jest.fn(); void inventory.then(settled);
    await jest.advanceTimersByTimeAsync(70000); expect(settled).not.toHaveBeenCalled();
    manager.emit('rawevent', { actionid: id, event: 'EndpointList', objectname: 'e101_42' });
    manager.emit('rawevent', { actionid: id, event: 'EndpointListComplete' });
    expect(await inventory).toMatchObject({ complete: true, events: [{ objectname: 'e101_42' }] });
    const channels = service.getActiveChannels(); await jest.advanceTimersByTimeAsync(15000);
    expect(await channels).toEqual({ complete: false, events: [] }); expect(jest.getTimerCount()).toBe(0);
  });
  it.each([[undefined, 120000], [1, 15000], [1000000, 180000], ['invalid', 120000], [90000, 90000]])('bounds configured inventory timeout %s at %s milliseconds', async (configured, timeout) => {
    jest.useFakeTimers(); const { service } = setup(configured === undefined ? {} : { DASHBOARD_AMI_INVENTORY_TIMEOUT_MS: configured });
    const promise = service.collectDashboardContacts(); const settled = jest.fn(); void promise.then(settled);
    await jest.advanceTimersByTimeAsync(Number(timeout) - 1); expect(settled).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1); expect(await promise).toEqual({ complete: false, events: [] });
    expect(jest.getTimerCount()).toBe(0);
  });
  it('cancels an in-flight bulk list and removes AMI, abort and timer listeners', async () => {
    jest.useFakeTimers(); const { service, manager } = setup(); const controller = new AbortController();
    const remove = jest.spyOn(controller.signal, 'removeEventListener');
    const promise = service.collectDashboardRegistrations(controller.signal); controller.abort();
    expect(await promise).toEqual({ complete: false, events: [] });
    expect(manager.listenerCount('rawevent')).toBe(0); expect(manager.listenerCount('close')).toBe(0);
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function)); expect(jest.getTimerCount()).toBe(0);
    const alreadyAborted = service.collectDashboardEndpoints(controller.signal);
    expect(await alreadyAborted).toEqual({ complete: false, events: [] }); expect(manager.action).toHaveBeenCalledTimes(1);
  });
  it('cleans a bulk list when manager.action throws synchronously', async () => {
    jest.useFakeTimers(); const { service, manager } = setup(); manager.action.mockImplementation(() => { throw new Error('write failed'); });
    await expect(service.collectDashboardEndpoints()).rejects.toThrow('write failed');
    expect(manager.listenerCount('rawevent')).toBe(0); expect(manager.listenerCount('close')).toBe(0); expect(jest.getTimerCount()).toBe(0);
  });


  it.each(['error', 'response'])('accepts the actual static-only ContactList empty marker in the %s callback slot', async (slot) => {
    jest.useFakeTimers(); const { service, manager } = setup();
    const terminal = { response: 'Error', message: 'No Contacts found\n' };
    manager.action.mockImplementation((_action, callback) => slot === 'error' ? callback(terminal) : callback(null, terminal));
    expect(await service.collectDashboardContacts()).toEqual({ events: [], complete: true });
    expect(manager.listenerCount('rawevent')).toBe(0); expect(manager.listenerCount('close')).toBe(0); expect(jest.getTimerCount()).toBe(0);
  });
  it.each(['Permission denied', 'No such command', 'Could not get Contacts'])('rejects other contact source errors: %s', async (message) => {
    const { service, manager } = setup(); manager.action.mockImplementation((_action, callback) => callback(null, { response: 'Error', message }));
    await expect(service.collectDashboardContacts()).rejects.toThrow(message);
  });
  it('does not apply the contact-empty marker to a channel snapshot or partial contact result', async () => {
    const { service, manager } = setup();
    manager.action.mockImplementation((_action, callback) => callback(null, { response: 'Error', message: 'No Contacts found' }));
    await expect(service.getActiveChannels()).rejects.toThrow('No Contacts found');
    manager.action.mockImplementation((action, callback) => {
      manager.emit('rawevent', { actionid: action.actionid, event: 'ContactList', objectname: 'e101_42;@one' });
      callback(null, { response: 'Error', message: 'No Contacts found' });
    });
    await expect(service.collectDashboardContacts()).rejects.toThrow('No Contacts found');
    expect(manager.listenerCount('rawevent')).toBe(0);
  });
});
