import { ForbiddenException } from '@nestjs/common';
import { UserLevel } from '../users/user.model';
import { assertSupervisor, isSupervisorUser, CC_SUPERVISOR_LEVELS } from './callcenter-rbac.util';
import {
  normalizeAccessToken,
  normalizeAccessTokenSet,
  accessTokenMatches,
  isUnrestrictedAccessList,
} from './callcenter-access-list.util';

describe('callcenter-rbac.util', () => {
  it('allows SUPERADMIN, ADMIN, SUPERVISOR', () => {
    expect(isSupervisorUser({ level: UserLevel.SUPERADMIN })).toBe(true);
    expect(isSupervisorUser({ level: UserLevel.ADMIN })).toBe(true);
    expect(isSupervisorUser({ level: UserLevel.SUPERVISOR })).toBe(true);
    expect(() => assertSupervisor({ level: UserLevel.ADMIN })).not.toThrow();
  });

  it('denies OPERATOR and READONLY', () => {
    expect(isSupervisorUser({ level: UserLevel.OPERATOR })).toBe(false);
    expect(isSupervisorUser({ level: UserLevel.READONLY })).toBe(false);
    expect(() => assertSupervisor({ level: UserLevel.READONLY })).toThrow(ForbiddenException);
    expect(() => assertSupervisor({ level: UserLevel.OPERATOR })).toThrow(ForbiddenException);
  });

  it('does not treat higher numeric levels as privileged', () => {
    expect(CC_SUPERVISOR_LEVELS.has(UserLevel.READONLY)).toBe(false);
    expect(isSupervisorUser({ level: 5 })).toBe(false);
  });
});

describe('callcenter-access-list.util', () => {
  it('normalizes short numbers, sip ids, interfaces, and queue names', () => {
    expect(normalizeAccessToken('201')).toBe('201');
    expect(normalizeAccessToken('e201_0')).toBe('201');
    expect(normalizeAccessToken('PJSIP/e201_0')).toBe('201');
    expect(normalizeAccessToken('q700_0')).toBe('700');
  });

  it('builds a set and matches flexibly', () => {
    const set = normalizeAccessTokenSet(['201', 'q700_0', 'PJSIP/e112_0']);
    expect(accessTokenMatches(set, 'e201_0')).toBe(true);
    expect(accessTokenMatches(set, '700')).toBe(true);
    expect(accessTokenMatches(set, '112')).toBe(true);
    expect(accessTokenMatches(set, '999')).toBe(false);
  });

  it('treats empty sets as unrestricted', () => {
    expect(isUnrestrictedAccessList(new Set())).toBe(true);
    expect(isUnrestrictedAccessList(null)).toBe(true);
    expect(isUnrestrictedAccessList(normalizeAccessTokenSet(['201']))).toBe(false);
  });
});
