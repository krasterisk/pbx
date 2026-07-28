import type { IEffectivePermissions, SpyMode } from '@/shared/api/endpoints/callCenterApi';

/** Boolean columns shown in the D-40 matrix (spy_modes is separate). */
export const PERMISSION_BOOL_KEYS = [
  'can_spy',
  'spyable',
  'click_to_call',
  'customize_ui',
] as const;

export type PermissionBoolKey = (typeof PERMISSION_BOOL_KEYS)[number];

export const ALL_SPY_MODES: SpyMode[] = ['listen', 'whisper', 'barge'];

export const EMPTY_PERMISSIONS: IEffectivePermissions = {
  can_spy: false,
  spyable: true,
  spy_modes: ['listen'],
  click_to_call: false,
  customize_ui: false,
};

/** UserLevel values that appear in role-defaults editor (matches backend USER_LEVELS). */
export const ROLE_DEFAULT_LEVELS = [
  { level: 1, key: 'admin' },
  { level: 2, key: 'operator' },
  { level: 3, key: 'supervisor' },
  { level: 5, key: 'readonly' },
] as const;
