import { describe, it, expect } from 'vitest';
import { UserLevel } from '@krasterisk/shared';
import {
  LEVEL_OPTIONS,
  PLATFORM_LEVEL_OPTIONS,
  LEVEL_I18N_KEYS,
  LEVEL_COLORS,
} from './userConsts';

describe('userConsts (NAV-16 / D-20)', () => {
  it('exposes SUPERADMIN in shared level consts for Users UI', () => {
    expect(LEVEL_I18N_KEYS[UserLevel.SUPERADMIN]).toBe('users.levelSuperadmin');
    expect(LEVEL_COLORS[UserLevel.SUPERADMIN]).toBeTruthy();
    expect(PLATFORM_LEVEL_OPTIONS.some((o) => o.value === UserLevel.SUPERADMIN)).toBe(true);
  });

  it('keeps tenant LEVEL_OPTIONS without SUPERADMIN (platform-only)', () => {
    const values = LEVEL_OPTIONS.map((o) => o.value as UserLevel);
    expect(values).not.toContain(UserLevel.SUPERADMIN);
    expect(values).toContain(UserLevel.ADMIN);
  });
});
