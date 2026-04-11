/**
 * Entity: User — Public API
 *
 * All imports from entities/User must go through this file.
 */

// Types
export type { IUser, IUserSafe, ICreateUser, IUpdateUser } from './model/types/user';
export { UserLevel } from './model/types/user';

// Constants
export { LEVEL_COLORS, LEVEL_I18N_KEYS, LEVEL_OPTIONS } from './model/consts/userConsts';

// Selectors
export {
  selectCurrentUser,
  selectUserLevel,
  selectIsAdmin,
  selectIsSupervisor,
} from './model/selectors/userSelectors';

// UI Components
export { UserLevelBadge } from './ui/UserLevelBadge/UserLevelBadge';
