import { UserLevel } from '../users/user.model';
import { RoleStartService } from './role-start.service';

describe('RoleStartService (08-02 / D-04 / D-16)', () => {
  let service: RoleStartService;
  let defaultsFindOne: jest.Mock;
  let tenantFindOne: jest.Mock;

  beforeEach(() => {
    defaultsFindOne = jest.fn().mockResolvedValue(null);
    tenantFindOne = jest.fn().mockResolvedValue(null);
    service = new RoleStartService(
      { findOne: defaultsFindOne, findAll: jest.fn().mockResolvedValue([]), upsert: jest.fn() } as any,
      { findOne: tenantFindOne, findAll: jest.fn().mockResolvedValue([]), upsert: jest.fn(), destroy: jest.fn() } as any,
    );
  });

  it('returns D-16 hardcoded defaults when DB empty', async () => {
    await expect(service.resolveStart(UserLevel.OPERATOR, 1, { callCenterEnabled: true }))
      .resolves.toBe('/callcenter/agent');
    await expect(service.resolveStart(UserLevel.SUPERVISOR, 1, { callCenterEnabled: true }))
      .resolves.toBe('/callcenter/supervisor');
    await expect(service.resolveStart(UserLevel.ADMIN, 1, { callCenterEnabled: true }))
      .resolves.toBe('/');
  });

  it('falls back to Overview when Call Center module not active (D-16)', async () => {
    await expect(service.resolveStart(UserLevel.OPERATOR, 1, { callCenterEnabled: false }))
      .resolves.toBe('/');
  });

  it('tenant override beats platform default', async () => {
    defaultsFindOne.mockResolvedValue({ user_level: UserLevel.OPERATOR, start_path: '/callcenter/agent' });
    tenantFindOne.mockResolvedValue({ tenant_id: 9, user_level: UserLevel.OPERATOR, start_path: '/queues' });

    await expect(service.resolveStart(UserLevel.OPERATOR, 9, { callCenterEnabled: true }))
      .resolves.toBe('/queues');
  });

  it('platform default used when no tenant override', async () => {
    defaultsFindOne.mockResolvedValue({ user_level: UserLevel.ADMIN, start_path: '/endpoints' });
    tenantFindOne.mockResolvedValue(null);

    await expect(service.resolveStart(UserLevel.ADMIN, 3, { callCenterEnabled: true }))
      .resolves.toBe('/endpoints');
  });
});
