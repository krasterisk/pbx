import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  LogOut,
  UserRound,
  Languages,
  Palette,
  Type,
} from 'lucide-react';
import {
  Avatar,
  NavItem,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  Text,
} from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import { logout } from '@/features/auth/model/authSlice';
import {
  readImpersonatedIdentity,
  readImpersonation,
} from '@/features/auth/lib/impersonationSession';
import { buildUserAvatarUrl } from '@/shared/lib/userAvatarUrl';
import styles from './UserBlock.module.scss';
import {
  useFontTrial,
  setFontTrial,
  EXTRA_FONT_TRIALS,
  type FontTrial,
} from '@/shared/lib/typography/fontTrial';

interface UserBlockProps {
  preferences?: {
    themeLabel: string;
    languageLabel: string;
    onThemeChange: () => void;
    onLanguageChange: () => void;
  };
  /** Optional override for display name (e.g. CC agent) */
  displayName?: string;
  /** Optional override for secondary line */
  secondaryLine?: string | null;
  className?: string;
}

export function UserBlock({
  displayName,
  secondaryLine,
  className,
  preferences,
}: UserBlockProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const fontTrial = useFontTrial();
  const user = useAppSelector((s) => s.auth.user);
  const accessToken = useAppSelector((s) => s.auth.accessToken);
  const impersonation = readImpersonation(accessToken);
  const identity = readImpersonatedIdentity(accessToken);
  const impersonationLabel = impersonation
    ? t('cloudAdmin.impersonation.asSuperadmin', 'Вход из-под суперадмина')
    : null;

  const name =
    identity?.name || displayName || user?.name || user?.login || 'U';
  const secondary =
    secondaryLine !== undefined
      ? secondaryLine
      : user?.exten
        ? `ext. ${user.exten}`
        : null;
  const triggerSecondary = impersonationLabel ?? secondary;

  const avatarUserId = identity?.uniqueid ?? user?.uniqueid;
  const avatarSrc =
    avatarUserId != null
      ? buildUserAvatarUrl(
          avatarUserId,
          identity ? null : user?.avatar,
          accessToken,
        )
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
        >
          <span className="sr-only">{t('auth.profile')} </span>
          <HStack gap="8" align="center">
            <VStack gap="0" className={styles.meta}>
              <Text className={styles.name}>{name}</Text>
              {triggerSecondary ? (
                <Text
                  className={
                    impersonationLabel ? styles.impersonation : styles.secondary
                  }
                >
                  {triggerSecondary}
                </Text>
              ) : null}
            </VStack>
            <Avatar name={name} src={avatarSrc} size={36} />
            <ChevronDown className={styles.chevron} />
          </HStack>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={styles.menu}>
        <DropdownMenuItem asChild>
          <NavItem id="user-block-profile" to="/profile">
            <UserRound size={16} className={styles.menuIcon} aria-hidden />
            {t('auth.profile')}
          </NavItem>
        </DropdownMenuItem>
        {preferences && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              id="shell-lang-toggle"
              aria-label={preferences.languageLabel}
              onSelect={preferences.onLanguageChange}
            >
              <Languages size={16} className={styles.menuIcon} aria-hidden />
              {preferences.languageLabel}
            </DropdownMenuItem>
            <DropdownMenuItem
              id="shell-theme-toggle"
              aria-label={preferences.themeLabel}
              onSelect={preferences.onThemeChange}
            >
              <Palette size={16} className={styles.menuIcon} aria-hidden />
              {preferences.themeLabel}
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Type size={16} aria-hidden />
            {t('auth.fontTrial.title', 'Font trial')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-[70vh] overflow-y-auto">
            <DropdownMenuLabel>
              {t('auth.fontTrial.hint', 'This tab only · across all pages')}
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={fontTrial}
              onValueChange={(value) => setFontTrial(value as FontTrial)}
            >
              <DropdownMenuRadioItem value="inter">
                {t('auth.fontTrial.inter', 'Inter · default')}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">
                {t('auth.fontTrial.system', 'System font')}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="arial">Arial</DropdownMenuRadioItem>
              {EXTRA_FONT_TRIALS.map(([value, label]) => (
                <DropdownMenuRadioItem key={value} value={value}>
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem id="user-block-logout" onSelect={handleLogout}>
          <LogOut className={styles.menuIcon} />
          {t('auth.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
