import { assertAutodialWriteRole, AutodialWriteGuard } from './autodial-write.guard';
import { UserLevel } from '../users/user.model';

describe('autodial write role boundary', () => {
  it.each([UserLevel.SUPERADMIN, UserLevel.ADMIN, UserLevel.SUPERVISOR])('permits role %s', (role) => {
    expect(() => assertAutodialWriteRole(role)).not.toThrow();
  });
  it.each([UserLevel.OPERATOR, UserLevel.READONLY, 99, undefined])('denies role %s', (role) => {
    expect(() => assertAutodialWriteRole(role)).toThrow();
  });
  it('keeps reads available without permitting writes to a read-only account', () => {
    const guard = new AutodialWriteGuard();
    const context = (method: string) => ({ switchToHttp: () => ({ getRequest: () => ({ method, user: { level: UserLevel.READONLY } }) }) }) as never;
    expect(guard.canActivate(context('GET'))).toBe(true);
    expect(() => guard.canActivate(context('POST'))).toThrow();
  });
});
