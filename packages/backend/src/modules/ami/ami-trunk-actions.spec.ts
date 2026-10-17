import { EventEmitter } from 'events';
import { ConfigService } from '@nestjs/config';
import { AmiService } from './ami.service';
const net: typeof import('net') = require('net');

const AsteriskManager = require('asterisk-manager');

function setup() {
  const manager = new EventEmitter() as EventEmitter & { action: jest.Mock; actionMock: jest.Mock; isConnected: jest.Mock };
  manager.actionMock = jest.fn((action, callback) => { manager.once(action.actionid, callback); callback(null, { response: 'Success' }); return action.actionid; });
  manager.action = manager.actionMock;
  manager.isConnected = jest.fn(() => true);
  const service = new AmiService(new ConfigService(), {} as never, {} as never);
  service['ami'] = manager; service['connected'] = true;
  return { service, manager };
}

/** Use the installed manager's real authentication and held-action implementation. */
function realManagerWithFakeTcp(loginDelay: number, failRegistrationWrite = false) {
  const socket = new EventEmitter() as EventEmitter & {
    readyState: string; setKeepAlive: jest.Mock; setNoDelay: jest.Mock; setEncoding: jest.Mock; write: jest.Mock; end: jest.Mock;
  };
  socket.readyState = 'open';
  socket.setKeepAlive = jest.fn(); socket.setNoDelay = jest.fn(); socket.setEncoding = jest.fn();
  const wireActions: string[] = [];
  socket.write = jest.fn((payload: string) => {
    const action = /(?:^|\r\n)action: ([^\r\n]+)/i.exec(payload)?.[1]?.toLowerCase();
    const actionId = /(?:^|\r\n)actionid: ([^\r\n]+)/i.exec(payload)?.[1];
    if (action === 'pjsipregister' && failRegistrationWrite) {
      failRegistrationWrite = false;
      throw new Error('fixture synchronous write failure');
    }
    wireActions.push(action ?? 'unknown');
    setTimeout(() => socket.emit('data', `Response: Success\r\nActionID: ${actionId}\r\nMessage: ${action === 'login' ? 'Authentication accepted' : 'Pong'}\r\n\r\n`), action === 'login' ? loginDelay : 0);
    return true;
  });
  socket.end = jest.fn(() => { socket.readyState = 'closed'; socket.emit('close'); });
  jest.spyOn(net, 'createConnection').mockReturnValue(socket as never);
  const manager = new AsteriskManager(5038, 'fixture', 'fixture', 'fixture', false);
  const service = new AmiService(new ConfigService(), {} as never, {} as never);
  service['ami'] = manager; service['connected'] = true;
  socket.emit('connect');
  return { service, manager, socket, wireActions };
}

describe('trunk AMI action safety and snapshot completeness', () => {
  it('injects monitor mode digits into ChanSpy without changing ordinary phone DTMF', async () => {
    const { service, manager } = setup();
    await service.playDtmf('PJSIP/monitor-1', '5', true);
    await service.playDtmf('PJSIP/agent-2', '1');
    const actions = manager.actionMock.mock.calls.map(call => call[0]).filter(action => action.action === 'PlayDTMF');
    expect(actions).toHaveLength(2);
    expect(actions[0]).toMatchObject({ channel: 'PJSIP/monitor-1', digit: '5', receive: 'true' });
    expect(actions[1]).not.toHaveProperty('receive');
  });
  afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });
  it('sends exactly one named registration, accepting only AMI Success', async () => {
    const { service, manager } = setup();
    expect(await service.pjsipRegister('t_test_7')).toEqual({ response: 'Success' });
    expect(manager.actionMock).toHaveBeenCalledTimes(2);
    expect(manager.actionMock.mock.calls[0][0]).toMatchObject({ action: 'Ping' });
    expect(manager.actionMock.mock.calls[1][0]).toMatchObject({ action: 'PJSIPRegister', registration: 't_test_7' });
    expect(manager.listenerCount('close')).toBe(0); expect(manager.eventNames()).toEqual([]);
  });
  it.each(['*all', 't_test_7\r\nRegistration: *all', 't_test_7 other', '', 'a'.repeat(256)])('rejects unsafe registration %j before AMI', async id => {
    const { service, manager } = setup(); await expect(service.pjsipRegister(id)).rejects.toThrow('Invalid registration');
    expect(manager.actionMock).not.toHaveBeenCalled();
  });
  it.each(['error', 'response'])('rejects AMI Error in the %s slot', async slot => {
    const { service, manager } = setup();
    manager.actionMock.mockImplementation((action, callback) => action.action === 'Ping' ? callback(null, { response: 'Success' }) : slot === 'error' ? callback({ response: 'Error', message: 'private provider URI' }) : callback(null, { response: 'Error' }));
    await expect(service.pjsipRegister('t_test_7')).rejects.toThrow('AMI registration request rejected');
    expect(manager.listenerCount('close')).toBe(0);
  });
  it('accepts the Success-as-error library workaround', async () => {
    const { service, manager } = setup(); manager.actionMock.mockImplementation((_action, callback) => callback({ response: 'Success' }));
    expect(await service.pjsipRegister('t_test_7')).toEqual({ response: 'Success' });
  });
  it('bounds a stalled register and cleans the manager response listener and timer', async () => {
    jest.useFakeTimers(); const { service, manager } = setup();
    manager.actionMock.mockImplementation((action, callback) => { manager.once(action.actionid, callback); if (action.action === 'Ping') callback(null, { response: 'Success' }); return action.actionid; });
    const promise = service.pjsipRegister('t_test_7'); const checked = expect(promise).rejects.toThrow('timeout');
    await jest.advanceTimersByTimeAsync(5000); await checked;
    expect(manager.eventNames()).toEqual([]); expect(jest.getTimerCount()).toBe(0);
  });
  it('cleans register listeners on disconnect or a synchronous write failure', async () => {
    const { service, manager } = setup(); manager.actionMock.mockImplementation((action, callback) => { manager.once(action.actionid, callback); return action.actionid; });
    const pending = service.pjsipRegister('t_test_7'); manager.emit('close'); await expect(pending).rejects.toThrow('disconnected');
    expect(manager.eventNames()).toEqual([]);
    manager.actionMock.mockImplementation(() => { throw new Error('write failed'); });
    await expect(service.pjsipRegister('t_test_7')).rejects.toThrow('rejected'); expect(manager.eventNames()).toEqual([]);
  });
  it('never sends a mutation after slow login completes beyond the request deadline', async () => {
    jest.useFakeTimers(); const { service, manager, wireActions } = realManagerWithFakeTcp(7000);
    const pending = service.pjsipRegister('t_test_7'); const checked = expect(pending).rejects.toThrow('timeout');
    await jest.advanceTimersByTimeAsync(5000); await checked;
    expect(wireActions).toEqual(['login']);
    await jest.advanceTimersByTimeAsync(2500);
    expect(wireActions).toEqual(['login', 'ping']);
    expect(wireActions).not.toContain('pjsipregister');
    manager.disconnect(); expect(jest.getTimerCount()).toBe(0);
  });
  it('allows one exact REGISTER only after the real manager completes timely authentication', async () => {
    jest.useFakeTimers(); const { service, manager, wireActions } = realManagerWithFakeTcp(100);
    const pending = service.pjsipRegister('t_test_7');
    await jest.advanceTimersByTimeAsync(500);
    expect(await pending).toMatchObject({ response: 'Success' });
    expect(wireActions).toEqual(['login', 'ping', 'pjsipregister']);
    manager.disconnect(); expect(jest.getTimerCount()).toBe(0);
  });
  it('blocks replay of a REGISTER privately held after a write failure and timeout', async () => {
    jest.useFakeTimers(); const { service, manager, socket, wireActions } = realManagerWithFakeTcp(100, true);
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const pending = service.pjsipRegister('t_test_7'); const checked = expect(pending).rejects.toThrow('timeout');
    await jest.advanceTimersByTimeAsync(500);
    const failedAttempts = socket.write.mock.calls.filter(([payload]) => /action: PJSIPRegister/i.test(payload));
    expect(failedAttempts).toHaveLength(1);
    await jest.advanceTimersByTimeAsync(4500); await checked;
    manager.login(() => undefined); await jest.advanceTimersByTimeAsync(500);
    expect(socket.write.mock.calls.filter(([payload]) => /action: PJSIPRegister/i.test(payload))).toHaveLength(1);
    expect(wireActions).not.toContain('pjsipregister');
    expect(consoleSpy).toHaveBeenCalled();
    manager.disconnect(); expect(jest.getTimerCount()).toBe(0);
  });
  it.each(['endpoint', 'registrations'])('requires matching completion for %s and ignores action-less/foreign rows', async source => {
    const { service, manager } = setup();
    const pending = source === 'endpoint' ? service.pjsipShowEndpoint('t_test_7') : service.pjsipShowRegistrations();
    const { actionid } = manager.actionMock.mock.calls[0][0];
    const event = source === 'endpoint' ? 'EndpointDetail' : 'OutboundRegistrationDetail';
    const complete = source === 'endpoint' ? 'EndpointDetailComplete' : 'OutboundRegistrationDetailComplete';
    manager.emit('rawevent', { event, actionid: 'foreign', status: 'Rejected' });
    manager.emit('rawevent', { event, status: 'Rejected' });
    manager.emit('rawevent', { event, actionid, status: 'Unregistered' });
    manager.emit('rawevent', { event: complete, actionid });
    expect(await pending).toEqual({ events: [{ event, actionid, status: 'Unregistered' }], complete: true });
    expect(manager.eventNames()).toEqual([]);
  });
  it.each(['endpoint', 'registrations'])('rejects partial %s results rather than reporting them as current', async source => {
    jest.useFakeTimers(); const { service, manager } = setup();
    const pending = source === 'endpoint' ? service.pjsipShowEndpoint('t_test_7') : service.pjsipShowRegistrations();
    const checked = expect(pending).rejects.toThrow('timeout'); const { actionid } = manager.actionMock.mock.calls[0][0];
    manager.emit('rawevent', { event: source === 'endpoint' ? 'EndpointDetail' : 'OutboundRegistrationDetail', actionid, devicestate: 'Unavailable', status: 'Rejected' });
    await jest.advanceTimersByTimeAsync(5000); await checked;
    expect(manager.eventNames()).toEqual([]); expect(jest.getTimerCount()).toBe(0);
  });
  it('accepts an empty completed list and rejects AMI errors or disconnection', async () => {
    const { service, manager } = setup(); const empty = service.pjsipShowRegistrations();
    manager.emit('rawevent', { event: 'OutboundRegistrationDetailComplete', actionid: manager.actionMock.mock.calls[0][0].actionid });
    expect(await empty).toEqual({ events: [], complete: true });
    manager.actionMock.mockImplementation((_action, callback) => callback(null, { response: 'Error' }));
    await expect(service.pjsipShowEndpoint('t_test_7')).rejects.toThrow('rejected');
    manager.actionMock.mockImplementation(() => undefined);
    const pending = service.pjsipShowEndpoint('t_test_7'); manager.emit('close'); await expect(pending).rejects.toThrow('disconnected');
    expect(manager.eventNames()).toEqual([]);
  });
});
