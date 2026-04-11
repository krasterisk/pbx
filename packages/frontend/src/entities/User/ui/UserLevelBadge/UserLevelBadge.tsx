import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { UserLevel } from '@krasterisk/shared';
import { LEVEL_COLORS, LEVEL_I18N_KEYS } from '../../model/consts/userConsts';

interface UserLevelBadgeProps {
  level: UserLevel;
  className?: string;
}

export const UserLevelBadge = memo(({ level, className = '' }: UserLevelBadgeProps) => {
  const { t } = useTranslation();

  const colorClass = LEVEL_COLORS[level] || 'text-gray-400 bg-gray-400/10';
  const label = t(LEVEL_I18N_KEYS[level] || 'users.levelOperator');

  return (
    <span className={`px-2 py-1 rounded-md text-xs font-medium ${colorClass} ${className}`}>
      {label}
    </span>
  );
});

UserLevelBadge.displayName = 'UserLevelBadge';
