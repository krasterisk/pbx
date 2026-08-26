import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, UserRound } from 'lucide-react';
import {
  Avatar,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Text,
} from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import { logout } from '@/features/auth/model/authSlice';
import { buildUserAvatarUrl } from '@/shared/lib/userAvatarUrl';
import styles from './UserBlock.module.scss';

interface UserBlockProps {
  /** Optional override for display name (e.g. CC agent) */
  displayName?: string;
  /** Optional override for secondary line */
  secondaryLine?: string | null;
  className?: string;
}

export function UserBlock({ displayName, secondaryLine, className }: UserBlockProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  const accessToken = useAppSelector((s) => s.auth.accessToken);

  const name = displayName || user?.name || user?.login || 'U';
  const secondary =
    secondaryLine !== undefined
      ? secondaryLine
      : user?.exten
        ? `ext. ${user.exten}`
        : null;

  const avatarSrc = user
    ? buildUserAvatarUrl(user.uniqueid, user.avatar, accessToken)
    : undefined;

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          id="user-block-trigger"
          variant="ghost"
          className={`${styles.trigger} ${className || ''}`}
          aria-label={t('auth.profile')}
        >
          <HStack gap="8" align="center">
            <VStack gap="0" className={styles.meta}>
              <Text className={styles.name}>{name}</Text>
              {secondary ? <Text className={styles.secondary}>{secondary}</Text> : null}
            </VStack>
            <Avatar name={name} src={avatarSrc} size={36} />
            <ChevronDown className={styles.chevron} />
          </HStack>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={styles.menu}>
        <DropdownMenuItem
          id="user-block-profile"
          onSelect={() => navigate('/profile')}
        >
          <UserRound className={styles.menuIcon} />
          {t('auth.profile')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          id="user-block-logout"
          onSelect={handleLogout}
        >
          <LogOut className={styles.menuIcon} />
          {t('auth.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
