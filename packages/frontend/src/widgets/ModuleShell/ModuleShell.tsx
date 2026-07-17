import { memo, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Phone, Search, Languages, Moon, Sun, LogOut } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import { HStack } from '@/shared/ui/Stack';
import {
  CommandPalette,
  buildPaletteItems,
} from '@/shared/ui/CommandPalette';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { logout } from '@/features/auth/model/authSlice';
import { UserLevel } from '@krasterisk/shared';
import { useHubModules } from '@/features/modules/hooks/useHubModules';
import { useModuleLicenseGate } from '@/features/modules/hooks/useModuleLicenseGate';
import {
  filterPagesByLevel,
  findModuleByPath,
  getModuleEntryPath,
} from '@/features/modules/lib/moduleRegistry';
import { ModuleBreadcrumbs } from './ModuleBreadcrumbs';
import { ModuleShellSidebar } from './ModuleShellSidebar';
import { OfflineBanner } from './OfflineBanner';
import cls from './ModuleShell.module.scss';

const COLLAPSE_KEY = 'krasterisk.moduleShell.collapsed';

interface ModuleShellProps {
  children?: ReactNode;
}

/**
 * In-module shell — A+C hybrid:
 * full-width topbar (logo inert, Module▾ → Page▾ menus) → sidebar | content.
 * Sidebar footer «Модули» → Hub. Mobile: sidebar auto-collapsed.
 */
export const ModuleShell = memo(function ModuleShell({ children }: ModuleShellProps) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile(768);
  const user = useAppSelector((s) => s.auth.user);
  const level = user?.level as UserLevel | undefined;
  const { active } = useHubModules();
  useModuleLicenseGate();

  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') !== 'light');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const isHub = location.pathname === '/modules' || location.pathname.startsWith('/modules/');
  const currentModule = isHub ? undefined : findModuleByPath(location.pathname);
  const hubRow = currentModule
    ? active.find((m) => m.code === currentModule.code)
    : undefined;

  const showSidebar =
    !!currentModule && !isHub && currentModule.code !== 'overview';

  const navPages = showSidebar
    ? filterPagesByLevel(currentModule.pages, level)
    : [];

  const currentPage = showSidebar
    ? navPages.find(
        (p) =>
          location.pathname === p.path ||
          (p.path !== '/' && location.pathname.startsWith(`${p.path}/`)),
      )
    : undefined;

  const moduleTitle = useMemo(() => {
    if (!currentModule || currentModule.code === 'overview') {
      return t('nav.dashboard');
    }
    return hubRow?.catalogName || t(hubRow?.labelKey ?? currentModule.labelKey);
  }, [currentModule, hubRow, t]);

  const licensedModules = useMemo(
    () => active.filter((m) => m.licenseStatus === 'active'),
    [active],
  );

  const moduleMenuItems = useMemo(
    () =>
      licensedModules.map((m) => ({
        id: m.code,
        label: m.catalogName || t(m.labelKey),
        onSelect: () => navigate(getModuleEntryPath(m, level)),
      })),
    [licensedModules, level, navigate, t],
  );

  const pageMenuItems = useMemo(
    () =>
      navPages.map((p) => ({
        id: p.id,
        label: t(p.labelKey),
        onSelect: () => navigate(p.path),
      })),
    [navPages, navigate, t],
  );

  const paletteItems = useMemo(() => {
    const licensed = licensedModules.map((m) => ({
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
  }, [licensedModules, currentModule, level, t]);

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

  const handleCollapsedChange = (next: boolean) => {
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
    } catch {
      /* ignore */
    }
  };

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
    <div className={cls.shellRoot} data-testid="module-shell">
      <OfflineBanner />

      <header className={cls.topbar}>
        <div className={cls.logo} id="shell-logo" aria-hidden="true">
          <span className={cls.logoBox}>
            <Phone size={18} aria-hidden />
          </span>
          <Text as="span" className={cls.logoText}>
            Krasterisk
          </Text>
        </div>

        {isHub ? (
          <ModuleBreadcrumbs hubLabel={t('hub.title')} />
        ) : (
          <ModuleBreadcrumbs
            moduleLabel={moduleTitle}
            moduleItems={moduleMenuItems}
            pageLabel={currentPage ? t(currentPage.labelKey) : undefined}
            pageItems={pageMenuItems.length > 0 ? pageMenuItems : undefined}
          />
        )}

        <div className={cls.spacer} />

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
          <span className={cls.avatar}>{user?.name?.charAt(0)?.toUpperCase() || 'U'}</span>
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
      </header>

      <div className={cls.body}>
        {showSidebar && currentModule && (
          <ModuleShellSidebar
            moduleTitle={moduleTitle}
            pages={navPages}
            collapsed={isMobile ? true : collapsed}
            onCollapsedChange={handleCollapsedChange}
          />
        )}
        <main className={cls.main}>{children}</main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        items={paletteItems}
      />
    </div>
  );
});
