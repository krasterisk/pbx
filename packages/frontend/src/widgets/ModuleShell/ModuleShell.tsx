import { memo, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Phone, Search, Languages, Moon, Sun, LogOut } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import { HStack, Flex } from '@/shared/ui/Stack';
import {
  CommandPalette,
  buildPaletteItems,
} from '@/shared/ui/CommandPalette';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import { logout } from '@/features/auth/model/authSlice';
import { UserLevel } from '@krasterisk/shared';
import { useHubModules } from '@/features/modules/hooks/useHubModules';
import {
  filterPagesByLevel,
  findModuleByPath,
  getModuleEntryPath,
} from '@/features/modules/lib/moduleRegistry';
import { ModuleChip } from './ModuleChip';
import { ModuleShellTabs } from './ModuleShellTabs';
import cls from './ModuleShell.module.scss';

/**
 * In-module shell — sketch winner 003-B: topbar + horizontal tabs.
 * Logo → /modules (D-10). ⌘K opens Dialog CommandPalette (D-06 / 08-04).
 */
export const ModuleShell = memo(function ModuleShell() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const level = user?.level as UserLevel | undefined;
  const { active } = useHubModules();

  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') !== 'light');
  const [paletteOpen, setPaletteOpen] = useState(false);

  const isHub = location.pathname === '/modules' || location.pathname.startsWith('/modules/');
  const currentModule = isHub ? undefined : findModuleByPath(location.pathname);
  const hubRow = currentModule
    ? active.find((m) => m.code === currentModule.code)
    : undefined;

  const chipLabel = isHub
    ? t('hub.chipEmpty')
    : hubRow
      ? hubRow.catalogName || t(hubRow.labelKey)
      : currentModule
        ? t(currentModule.labelKey)
        : t('hub.chipEmpty');

  // Overview: chip/context only — no inventing product-module tabs (D-14)
  const showTabs =
    !!currentModule &&
    !isHub &&
    currentModule.code !== 'overview' &&
    currentModule.navVariant === 'tabs';

  const tabPages = showTabs
    ? filterPagesByLevel(currentModule.pages, level)
    : [];

  const paletteItems = useMemo(() => {
    const licensed = active
      .filter((m) => m.licenseStatus === 'active')
      .map((m) => ({
        code: m.code,
        label: m.catalogName || t(m.labelKey),
        entryPath: getModuleEntryPath(m, level),
      }));

    const pages =
      currentModule && currentModule.code !== 'overview'
        ? filterPagesByLevel(currentModule.pages, level).map((p) => ({
            id: p.id,
            label: t(p.labelKey),
            path: p.path,
          }))
        : [];

    return buildPaletteItems(licensed, pages);
  }, [active, currentModule, level, t]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'k') return;
      if (!(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      setPaletteOpen((open) => !open);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const toggleTheme = () => {
    const html = document.documentElement;
    if (isDark) {
      html.classList.remove('dark');
      html.classList.add('light');
      localStorage.setItem('theme', 'light');
    } else {
      html.classList.remove('light');
      html.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
    setIsDark(!isDark);
  };

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'ru' ? 'en' : 'ru');
  };

  return (
    <Flex direction="column" className={cls.shell} data-testid="module-shell">
      <HStack className={cls.topbar} align="center" gap="12" max>
        <Link to="/modules" className={cls.logo} aria-label={t('hub.title')} id="shell-logo">
          <Flex className={cls.logoBox} align="center" justify="center">
            <Phone size={18} aria-hidden />
          </Flex>
          <Text as="span" className={cls.logoText}>
            Krasterisk
          </Text>
        </Link>

        <ModuleChip currentLabel={chipLabel} modules={active} level={level} />

        <Flex className={cls.spacer} />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          id="shell-cmdk-trigger"
          onClick={() => setPaletteOpen(true)}
          aria-label={t('commandPalette.placeholder')}
        >
          <Search size={16} aria-hidden />
          <span className={cls.cmdHint}>⌘K</span>
        </Button>

        <Button
          id="shell-lang-toggle"
          variant="ghost"
          size="icon"
          onClick={toggleLanguage}
          title={i18n.language.toUpperCase()}
        >
          <Languages className="w-4 h-4" />
        </Button>

        <Button id="shell-theme-toggle" variant="ghost" size="icon" onClick={toggleTheme}>
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>

        <HStack gap="8" align="center">
          <Text as="span" className={cls.userName}>
            {user?.name}
          </Text>
          <Flex className={cls.avatar} align="center" justify="center">
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </Flex>
          <Button
            id="shell-logout-btn"
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            title={t('auth.logout')}
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </HStack>
      </HStack>

      {showTabs && <ModuleShellTabs pages={tabPages} />}

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        items={paletteItems}
      />
    </Flex>
  );
});
