import { createHash } from 'node:crypto';
import { PhoneSessionService, PHONE_LEASE_MS, phoneDialTarget } from './phone-session.service';

const owner = '11111111-1111-4111-8111-111111111111';
const hash = createHash('sha256').update(owner).digest('hex');

describe('ordinary-user phone ownership', () => {
  let service: PhoneSessionService;
  let row: any, sessions: any, endpoints: any, shifts: any, users: any, ami: any, credentials: any;
  const tx = { LOCK: { UPDATE: 'UPDATE' } };
  beforeEach(() => {
    row = { endpoint: null, mode: null, owner_hash: null, expires_at: 0,
      update: jest.fn(async (values) => { Object.assign(row, values); }) };
    sessions = { findOrCreate: jest.fn(async () => [row]),
      findOne: jest.fn(async (options) => options.lock ? row : null), findAll: jest.fn(async () => []) };
    endpoints = { findOne: jest.fn(async (options) => ({ id: options.where.id, context: 'from-internal7', webrtc: 'yes' })),
      findAll: jest.fn(async () => [{ id: 'e101_7', callerid: '"Alice" <101>' }, { id: 'ew101_7', webrtc: 'yes' }]) };
    users = { findOne: jest.fn(async () => ({ level: 2 })) };
    shifts = { findOne: jest.fn(async () => null), findAll: jest.fn(async () => []) };
    ami = { getActiveChannels: jest.fn(async () => ({ complete: true, events: [] })), action: jest.fn(async () => ({})),
      isPjsipEndpointReachable:jest.fn(async()=>true), collectDashboardEndpoints:jest.fn(async()=>({complete:true,events:[{objectname:'e101_7',devicestate:'Not in use'}]})) };
    credentials = { getCredentials: jest.fn(async () => ({ username: 'ew101_7', password: 'private-test', domain: 'pbx.test' })) };
    service = new PhoneSessionService({ transaction: async (fn: any) => fn(tx) } as any, sessions, endpoints, users, shifts, credentials, ami);
  });
  async function connect() { return service.acquire(7, 42, 'e101_7', 'sip', owner); }
  it('restores only an existing live lease owned by this window, with absence as normal null',async()=>{
    expect(await service.restore(7,42,owner)).toBeNull();
    await connect();sessions.findOne.mockResolvedValue(row);
    expect(await service.restore(7,42,owner)).toMatchObject({endpoint:'e101_7',mode:'sip'});
    expect(await service.restore(7,42,'22222222-2222-4222-8222-222222222222')).toBeNull();
    row.expires_at=0;expect(await service.restore(7,42,owner)).toBeNull();
    users.findOne.mockResolvedValue({level:5});await expect(service.restore(7,42,owner)).rejects.toThrow('access denied');
  });
  it('does not offer or acquire an unregistered desk phone',async()=>{
    ami.collectDashboardEndpoints.mockResolvedValue({complete:true,events:[]});
    expect((await service.list(7,42)).endpoints[0].sipAvailable).toBe(false);
    ami.isPjsipEndpointReachable.mockResolvedValue(false);
    await expect(connect()).rejects.toThrow('not registered');expect(row.endpoint).toBeNull();
  });
  it('reuses the tenant contact book without exposing notes or endpoint configuration', async () => {
    const contacts = {findAll:jest.fn(async()=>[{uid:1,name:'Client',number:'123',note:'private note'}])};
    const directory = new PhoneSessionService({} as any,sessions,endpoints,users,shifts,credentials,ami,contacts as any);
    const result = await directory.directory(7,42);
    expect(contacts.findAll).toHaveBeenCalledWith(expect.objectContaining({where:{user_uid:7},attributes:['uid','name','number']}));
    expect(result.rows).toEqual(expect.arrayContaining([{id:'contact:1',name:'Client',number:'123',kind:'contact'}]));
    expect(JSON.stringify(result)).not.toContain('private note');
    expect(result.rows.filter(row=>row.kind==='employee').map(row=>row.number)).toEqual(['101']);
    users.findOne.mockResolvedValue({level:5}); contacts.findAll.mockClear();
    await expect(directory.directory(7,42)).rejects.toThrow('access denied');
    expect(contacts.findAll).not.toHaveBeenCalled();
  });
  it('switches an idle owned number without releasing the old lease first', async () => {
    await connect();
    const next = await service.acquire(7, 42, 'e102_7', 'sip', owner);
    expect(next.extension).toBe('102');
    expect(row.endpoint).toBe('e102_7');
    expect(row.owner_hash).toBe(hash);
    expect(shifts.create).toBeUndefined();
  });
  it('keeps the old number when the new number is busy', async () => {
    await connect();
    ami.getActiveChannels.mockResolvedValue({ complete: true, events: [{ channel:'PJSIP/ew102_7-00000a' }] });
    await expect(service.acquire(7, 42, 'e102_7', 'sip', owner)).rejects.toThrow('active call');
    expect(row.endpoint).toBe('e101_7');
  });
  it('cannot switch away from an active call or pending dial', async () => {
    await connect(); row.dial_pending_until = Date.now() + 10_000;
    await expect(service.acquire(7, 42, 'e102_7', 'sip', owner)).rejects.toThrow('being started');
    row.dial_pending_until = 0;
    ami.getActiveChannels.mockResolvedValue({ complete: true, events: [{ channel:'PJSIP/ew101_7-00000a' }] });
    await expect(service.acquire(7, 42, 'e102_7', 'sip', owner)).rejects.toThrow('active call');
    expect(row.endpoint).toBe('e101_7');
  });
  it('excludes both live channel twins from available numbers', async () => {
    ami.getActiveChannels.mockResolvedValue({ complete: true, events: [{ channel:'PJSIP/ew101_7-00000a' }] });
    expect((await service.list(7, 42)).endpoints[0].available).toBe(false);
    ami.getActiveChannels.mockResolvedValue({ complete:false,events:[] });
    const result = await service.list(7,42);
    expect(result.availabilityKnown).toBe(false); expect(result.endpoints[0].available).toBe(false);
  });
  it('requires WebRTC to be enabled, not merely an existing twin', async () => {
    const previous = process.env.ASTERISK_WSS_URL; process.env.ASTERISK_WSS_URL='wss://pbx.test/ws';
    endpoints.findOne.mockImplementation(async options => ({id:options.where.id, webrtc:'no'}));
    try { await expect(service.acquire(7,42,'e101_7','webrtc',owner)).rejects.toThrow('not configured'); }
    finally { if(previous===undefined)delete process.env.ASTERISK_WSS_URL;else process.env.ASTERISK_WSS_URL=previous; }
    expect(row.endpoint).toBeNull();
  });
  it.each(['1\r\nAction: Hangup', '123,foo', 'SIP/100', '123;456', '+12+34', 'abc'])('rejects unsafe dial target %s', (value) => {
    expect(() => phoneDialTarget(value)).toThrow();
  });
  it('normalizes formatted numbers and preserves PBX feature codes', () => {
    expect(phoneDialTarget('+7 (913) 555-11-22')).toBe('+79135551122');
    expect(phoneDialTarget('*8101#')).toBe('*8101#');
  });
  it('denies readonly users using current DB permissions', async () => {
    users.findOne.mockResolvedValue({ level: 5 });
    await expect(connect()).rejects.toThrow('access denied');
    expect(sessions.findOrCreate).not.toHaveBeenCalled();
  });
  it('rejects foreign tenant endpoints before obtaining any lease', async () => {
    await expect(service.acquire(7, 42, 'ew101_8', 'sip', owner)).rejects.toThrow('another organisation');
    expect(endpoints.findOne).not.toHaveBeenCalled();
  });
  it('serializes on user then primary endpoint and stores only owner hash', async () => {
    const result = await service.acquire(7, 42, 'ew101_7', 'sip', owner);
    expect(result.endpoint).toBe('e101_7');
    expect(row.owner_hash).toBe(hash);
    expect(row.expires_at).toBeGreaterThan(Date.now() + PHONE_LEASE_MS - 1000);
    expect(sessions.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { tenant: 7, user_id: 42 }, lock: 'UPDATE', transaction: tx }));
    expect(endpoints.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'e101_7', tenantid: '7' }, lock: 'UPDATE' }));
    expect(shifts.create).toBeUndefined();
  });
  it('does not steal an existing browser window lease', async () => {
    await connect();
    await expect(service.acquire(7, 42, 'e101_7', 'sip', '22222222-2222-4222-8222-222222222222')).rejects.toThrow('already active');
  });
  it('rejects another owner on the primary/WebRTC pair', async () => {
    sessions.findOne.mockImplementation(async (options: any) => options.lock ? row : { user_id: 99 });
    await expect(connect()).rejects.toThrow('already in use');
  });
  it('refuses ordinary phone login with an open CC shift', async () => {
    shifts.findOne.mockResolvedValue({ user_id: 42 });
    await expect(connect()).rejects.toThrow('call-centre');
    expect(row.update).not.toHaveBeenCalled();
  });
  it('refuses CC login while ordinary phone ownership is active', async () => {
    sessions.findOne.mockImplementation(async (options: any) => options.lock ? row : { endpoint: 'e101_7' });
    const login = jest.fn();
    await expect(service.guardCallCenterLogin('PJSIP/ew101_7', 7, 42, login)).rejects.toThrow('Disconnect');
    expect(login).not.toHaveBeenCalled();
  });
  it('runs the existing CC login under the same primary endpoint lock', async () => {
    const login = jest.fn(async () => 'shift');
    await expect(service.guardCallCenterLogin('PJSIP/ew101_7', 7, 42, login)).resolves.toBe('shift');
    expect(endpoints.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'e101_7', tenantid: '7' }, transaction: tx, lock: 'UPDATE' }));
    expect(login).toHaveBeenCalledTimes(1);
  });
  it('fails closed when channel inventory is incomplete', async () => {
    ami.getActiveChannels.mockResolvedValue({ complete: false, events: [] });
    await expect(connect()).rejects.toThrow('Cannot verify');
  });
  it('an expired lease cannot steal a live twin call', async () => {
    ami.getActiveChannels.mockResolvedValue({ complete: true, events: [{ channel: 'PJSIP/ew101_7-000000a' }] });
    await expect(connect()).rejects.toThrow('active call');
  });
  it.each(['123', '+79135551122', '*43', '#123'])('dial preserves %s using the owned endpoint and actual dialplan', async (target) => {
    await connect();
    await expect(service.dial(7, 42, owner, target)).resolves.toEqual({ success: true, mode: 'sip', target });
    expect(ami.action).toHaveBeenCalledWith(expect.objectContaining({ channel: 'PJSIP/e101_7', exten: target, context: 'krsk-click-to-call',
      variable: 'KRSK_CTC_CONTEXT=from-internal7,KRSK_CTC_OP_NUM=101' }));
  });
  it('does not dial on expired or different-window credentials', async () => {
    await connect(); row.expires_at = Date.now() - 1;
    await expect(service.dial(7, 42, owner, '123')).rejects.toThrow('expired');
    expect(ami.action).not.toHaveBeenCalled();
  });
  it('serializes repeated dial requests before AMI publishes the channel', async () => {
    await connect();
    await service.dial(7, 42, owner, '123');
    await expect(service.dial(7, 42, owner, '124')).rejects.toThrow('being started');
    await expect(service.release(7, 42, owner)).rejects.toThrow('being started');
    expect(ami.action).toHaveBeenCalledTimes(1);
  });
  it('does not release a live desk-phone call', async () => {
    await connect();
    ami.getActiveChannels.mockResolvedValue({ complete: true, events: [{ Channel: 'PJSIP/e101_7-000000a' }] });
    await expect(service.release(7, 42, owner)).rejects.toThrow('active call');
    expect(row.endpoint).toBe('e101_7');
  });
  it('does not expose endpoint credentials in selector payload', async () => {
    const result = await service.list(7, 42);
    expect(result.endpoints[0]).toEqual(expect.objectContaining({ id: 'e101_7', name: 'Alice', available: true }));
    expect(JSON.stringify(result)).not.toMatch(/password|authType|context/);
  });
});
