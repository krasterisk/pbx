import { BadGatewayException, BadRequestException, GatewayTimeoutException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { HTTP_CODE_METADATA, GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../auth/roles.guard';
import { ROLES_KEY } from '../auth/roles.decorator';
import { UserLevel } from '../users/user.model';
import { TrunksController } from './trunks.controller';
import { TrunksService } from './trunks.service';

function fixture(ids = ['t_test_7'], registeredIds = ids) {
  const endpoints = { findAll: jest.fn(async ({ where }) => ids.filter(id => where.id.includes(id) && where.tenantid === '7').map(id => ({ id }))), create: jest.fn(), update: jest.fn(), destroy: jest.fn() };
  const registrations = { findAll: jest.fn(async ({ where }) => registeredIds.filter(id => where.id.includes(id)).map(id => ({ id, endpoint: id }))), create: jest.fn(), update: jest.fn(), destroy: jest.fn() };
  const related = { create: jest.fn(), update: jest.fn(), destroy: jest.fn() };
  const sequelize = { transaction: jest.fn() };
  const ami = { isConnected: jest.fn(() => true), pjsipRegister: jest.fn().mockResolvedValue({ response: 'Success' }), moduleReload: jest.fn(), pjsipReload: jest.fn(), pjsipUnregister: jest.fn(), command: jest.fn() };
  const logger = { logAction: jest.fn().mockResolvedValue(undefined) };
  const service = new TrunksService(endpoints as never, related as never, related as never, registrations as never, related as never, sequelize as never, ami as never, logger as never);
  return { service, ami, endpoints, registrations, related, sequelize, logger };
}

describe('tenant-scoped registration actions', () => {
  afterEach(() => jest.useRealTimers());
  it('uses the stored registration identifier and audits acceptance without configuration writes', async () => {
    const { service, ami, endpoints, registrations, related, sequelize, logger } = fixture();
    expect(await service.register('t_test_7', 7, 23)).toEqual({ id: 't_test_7', status: 'requested' });
    expect(endpoints.findAll).toHaveBeenCalledWith({ where: { id: ['t_test_7'], tenantid: '7' }, attributes: ['id'] });
    expect(ami.pjsipRegister).toHaveBeenCalledWith('t_test_7');
    expect(logger.logAction).toHaveBeenCalledWith(23, 'register', 'trunk', null, 7, 'Outbound registration request t_test_7: requested', 'success');
    for (const model of [endpoints, registrations, related]) for (const method of ['create', 'update', 'destroy']) expect(model[method]).not.toHaveBeenCalled();
    expect(sequelize.transaction).not.toHaveBeenCalled();
    for (const method of ['moduleReload', 'pjsipReload', 'pjsipUnregister', 'command']) expect(ami[method]).not.toHaveBeenCalled();
  });
  it.each([[['t_foreign_8']], [['t_test_7', 't_foreign_8']]])('rejects all of a foreign or mixed selection %j before any AMI', async ids => {
    const { service, ami, registrations } = fixture();
    await expect(service.bulkRegister(ids, 7, 23)).rejects.toBeInstanceOf(NotFoundException);
    expect(ami.pjsipRegister).not.toHaveBeenCalled();
    expect(registrations.findAll).not.toHaveBeenCalled();
  });
  it.each([undefined, [], ['*all'], ['t_test_7\r\nAction: PJSIPUnregister'], ['t_test_7 '], ['e201_7'], ['t_test_7', 't_test_7'], Array.from({ length: 101 }, (_, i) => `t_${i}_7`)].map(ids => [ids]))('rejects invalid input %j before database or AMI access', async ids => {
    const { service, ami, endpoints } = fixture();
    await expect(service.bulkRegister(ids, 7, 23)).rejects.toBeInstanceOf(BadRequestException);
    expect(endpoints.findAll).not.toHaveBeenCalled(); expect(ami.pjsipRegister).not.toHaveBeenCalled();
  });
  it('requires verified tenant and actor context', async () => {
    const { service, ami } = fixture();
    await expect(service.bulkRegister(['t_test_7'], undefined as never, 23)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.register('t_test_7', 7, undefined as never)).rejects.toBeInstanceOf(BadRequestException);
    expect(ami.pjsipRegister).not.toHaveBeenCalled();
  });
  it('skips IP-only bulk targets and rejects the individual IP action', async () => {
    const { service, ami } = fixture(['t_test_7', 't_ip_7'], ['t_test_7']);
    expect(await service.bulkRegister(['t_ip_7', 't_test_7'], 7, 23)).toEqual({ results: [
      { id: 't_ip_7', status: 'skipped', reason: 'registration_not_configured' }, { id: 't_test_7', status: 'requested' },
    ] });
    await expect(service.register('t_ip_7', 7, 23)).rejects.toBeInstanceOf(BadRequestException);
    expect(ami.pjsipRegister).toHaveBeenCalledTimes(1);
  });
  it('refuses a corrupt stored endpoint binding rather than touching another registration', async () => {
    const { service, ami, registrations } = fixture();
    registrations.findAll.mockResolvedValue([{ id: 't_test_7', endpoint: 't_foreign_8' }]);
    expect(await service.bulkRegister(['t_test_7'], 7, 23)).toEqual({ results: [{ id: 't_test_7', status: 'failed', reason: 'invalid_registration' }] });
    expect(ami.pjsipRegister).not.toHaveBeenCalled();
  });
  it('reports a returned AMI Error as failed, with no secret-bearing raw message', async () => {
    const { service, ami, logger } = fixture();
    ami.pjsipRegister.mockResolvedValue({ response: 'Error', message: 'secret provider credentials' });
    expect(await service.bulkRegister(['t_test_7'], 7, 23)).toEqual({ results: [{ id: 't_test_7', status: 'failed', reason: 'ami_rejected' }] });
    await expect(service.register('t_test_7', 7, 23)).rejects.toBeInstanceOf(BadGatewayException);
    expect(JSON.stringify(logger.logAction.mock.calls)).not.toContain('secret');
  });
  it('reports AMI disconnection without sending actions', async () => {
    const { service, ami } = fixture(); ami.isConnected.mockReturnValue(false);
    expect(await service.bulkRegister(['t_test_7'], 7, 23)).toEqual({ results: [{ id: 't_test_7', status: 'failed', reason: 'ami_unavailable' }] });
    await expect(service.register('t_test_7', 7, 23)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(ami.pjsipRegister).not.toHaveBeenCalled();
  });
  it('coalesces concurrent targets and rate-limits repeated requests with a finite cooldown', async () => {
    jest.useFakeTimers(); const { service, ami } = fixture();
    let release: (value: unknown) => void = () => undefined;
    ami.pjsipRegister.mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const first = service.register('t_test_7', 7, 23); const second = service.bulkRegister(['t_test_7'], 7, 24);
    await jest.advanceTimersByTimeAsync(0); expect(ami.pjsipRegister).toHaveBeenCalledTimes(1);
    release({ response: 'Success' }); await Promise.all([first, second]);
    await service.register('t_test_7', 7, 23); expect(ami.pjsipRegister).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(10000); ami.pjsipRegister.mockResolvedValue({ response: 'Success' });
    await service.register('t_test_7', 7, 23); expect(ami.pjsipRegister).toHaveBeenCalledTimes(2);
  });
  it('bounds concurrent AMI operations across HTTP requests at eight', async () => {
    const ids = Array.from({ length: 20 }, (_, i) => `t_${i}_7`); const { service, ami } = fixture(ids);
    const releases: Array<() => void> = [];
    let active = 0; let peak = 0;
    ami.pjsipRegister.mockImplementation(() => new Promise(resolve => {
      active++; peak = Math.max(peak, active); releases.push(() => { active--; resolve({ response: 'Success' }); });
    }));
    const promises = [service.bulkRegister(ids.slice(0, 10), 7, 23), service.bulkRegister(ids.slice(10), 7, 24)];
    for (let round = 0; round < 10; round++) { await new Promise(resolve => setImmediate(resolve)); releases.splice(0).forEach(release => release()); }
    const results = await Promise.all(promises);
    expect(results.flatMap(result => result.results)).toHaveLength(20); expect(peak).toBe(8); expect(active).toBe(0);
    expect(ami.pjsipRegister).toHaveBeenCalledTimes(20);
  });
  it('times out a stalled AMI request and allows subsequent work after cooldown', async () => {
    jest.useFakeTimers(); const { service, ami } = fixture(); ami.pjsipRegister.mockReturnValue(new Promise(() => undefined));
    const promise = service.register('t_test_7', 7, 23); const checked = expect(promise).rejects.toBeInstanceOf(GatewayTimeoutException);
    await jest.advanceTimersByTimeAsync(6000); await checked;
    expect(service['activeRegistrationRequests']).toBe(0); expect(jest.getTimerCount()).toBe(0);
    await jest.advanceTimersByTimeAsync(10000); ami.pjsipRegister.mockResolvedValue({ response: 'Success' });
    expect(await service.register('t_test_7', 7, 23)).toMatchObject({ status: 'requested' });
  });
  it('bounds retained cooldown state and refuses overflow without extra AMI actions', async () => {
    const ids = Array.from({ length: 520 }, (_, i) => `t_${i}_7`); const { service, ami } = fixture(ids);
    for (const id of ids) await service.bulkRegister([id], 7, 23);
    expect(service['registrationRequests'].size).toBe(512); expect(ami.pjsipRegister).toHaveBeenCalledTimes(512);
    expect(await service.bulkRegister([ids[519]], 7, 23)).toEqual({ results: [{ id: ids[519], status: 'failed', reason: 'busy' }] });
  });
});

describe('registration route authorization', () => {
  it.each(['register', 'bulkRegister'] as const)('requires administrator permissions and returns HTTP202 for %s', method => {
    const handler = TrunksController.prototype[method];
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(202);
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toContain(RolesGuard);
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([UserLevel.ADMIN]);
    const guard = new RolesGuard(new Reflector());
    const context = (level: UserLevel) => ({ getHandler: () => handler, getClass: () => TrunksController, switchToHttp: () => ({ getRequest: () => ({ user: { level } }) }) });
    expect(guard.canActivate(context(UserLevel.ADMIN) as never)).toBe(true);
    expect(guard.canActivate(context(UserLevel.SUPERADMIN) as never)).toBe(true);
    expect(() => guard.canActivate(context(UserLevel.OPERATOR) as never)).toThrow();
    expect(() => guard.canActivate(context(UserLevel.READONLY) as never)).toThrow();
  });
  it('uses tenant and actor from authentication, ignoring forged body fields', () => {
    const service = { bulkRegister: jest.fn(), register: jest.fn() }; const controller = new TrunksController(service as never);
    const req = { user: { vpbx_user_uid: 7, uid: 23 } } as never;
    controller.bulkRegister({ ids: ['t_test_7'], vpbx_user_uid: 8, uid: 99 } as never, req);
    controller.register('t_test_7', req);
    expect(service.bulkRegister).toHaveBeenCalledWith(['t_test_7'], 7, 23);
    expect(service.register).toHaveBeenCalledWith('t_test_7', 7, 23);
  });
});
