import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@/app/store/store';
import { UserLevel } from '@krasterisk/shared';

/** Select the current authenticated user from auth state */
export const selectCurrentUser = (state: RootState) => state.auth.user;

/** Select user level */
export const selectUserLevel = createSelector(
  selectCurrentUser,
  (user) => user?.level,
);

/** Is the current user an admin? */
export const selectIsAdmin = createSelector(
  selectUserLevel,
  (level) => level === UserLevel.ADMIN,
);

/** Is the current user a supervisor? */
export const selectIsSupervisor = createSelector(
  selectUserLevel,
  (level) => level === UserLevel.SUPERVISOR,
);
