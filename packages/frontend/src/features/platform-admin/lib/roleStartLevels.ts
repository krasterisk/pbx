import { UserLevel } from '@krasterisk/shared';

/** Levels editable in platform role→start matrix (tenant-facing roles). */
export const ROLE_START_LEVELS: Array<{ level: UserLevel; labelKey: string }> = [
  { level: UserLevel.ADMIN, labelKey: 'users.levelAdmin' },
  { level: UserLevel.OPERATOR, labelKey: 'users.levelOperator' },
  { level: UserLevel.SUPERVISOR, labelKey: 'users.levelSupervisor' },
  { level: UserLevel.READONLY, labelKey: 'users.levelReadonly' },
];
