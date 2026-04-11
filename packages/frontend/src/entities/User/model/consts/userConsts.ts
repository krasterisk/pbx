import { UserLevel } from '@krasterisk/shared';

/**
 * CSS class mappings for user level badges.
 * Used by UserLevelBadge and table columns.
 */
export const LEVEL_COLORS: Record<UserLevel, string> = {
  [UserLevel.ADMIN]: 'text-red-400 bg-red-400/10',
  [UserLevel.OPERATOR]: 'text-blue-400 bg-blue-400/10',
  [UserLevel.SUPERVISOR]: 'text-purple-400 bg-purple-400/10',
  [UserLevel.READONLY]: 'text-gray-400 bg-gray-400/10',
};

/**
 * i18n translation keys for user levels.
 */
export const LEVEL_I18N_KEYS: Record<UserLevel, string> = {
  [UserLevel.ADMIN]: 'users.levelAdmin',
  [UserLevel.OPERATOR]: 'users.levelOperator',
  [UserLevel.SUPERVISOR]: 'users.levelSupervisor',
  [UserLevel.READONLY]: 'users.levelReadonly',
};

/**
 * Level options for select dropdowns (value + i18n key).
 */
export const LEVEL_OPTIONS = [
  { value: UserLevel.ADMIN, i18nKey: 'users.levelAdmin' },
  { value: UserLevel.OPERATOR, i18nKey: 'users.levelOperator' },
  { value: UserLevel.SUPERVISOR, i18nKey: 'users.levelSupervisor' },
  { value: UserLevel.READONLY, i18nKey: 'users.levelReadonly' },
] as const;
