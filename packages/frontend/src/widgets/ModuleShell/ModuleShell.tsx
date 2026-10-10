import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Phone, Search, Languages, Moon, Sun, Sparkles } from 'lucide-react';
import { Button, Text, Tooltip } from '@/shared/ui';
import { Flex, HStack } from '@/shared/ui/Stack';
import { AssistantPanel, type AssistantPanelMode } from '@/widgets/AssistantPanel';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import { aiChatActions } from '@/features/ai-chat/model/slice/aiChatSlice';
import {
  CommandPalette,
  buildPaletteItems,
} from '@/shared/ui/CommandPalette';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { selectMyAgent } from '@/features/callcenter/model/selectors/callCenterSelectors';
import { agentDisplayName } from '@/features/callcenter/lib/displayLabels';
import { interfaceToExtension } from '@/features/endpoints/lib/endpointIds';
import { UserLevel } from '@krasterisk/shared';
import type { ModulePageDef } from '@/features/modules/types';
import { useHubModules } from '@/features/modules/hooks/useHubModules';
import { useModuleLicenseGate } from '@/features/modules/hooks/useModuleLicenseGate';
import { UserBlock } from '@/widgets/UserBlock';
import {
  filterPagesByLevel,
  findModuleByPath,
} from '@/features/modules/lib/moduleRegistry';
import { ConferenceSessionProvider } from '@/features/conferences/lib/ConferenceSessionProvider';
import { ConferenceMiniPanel } from '@/features/conferences/ui/ConferenceMiniPanel';
import { readImpersonation } from '@/features/auth/lib/impersonationSession';
import { ModuleDestinationProvider, useNavigationHistory } from '@/features/modules/hooks/useNavigationHistory';
import { findPageByPath } from '@/features/modules/lib/navigation';
import { ModuleBreadcrumbs } from './ModuleBreadcrumbs';
import { MobileModuleMenu } from './MobileModuleMenu';
import { ModuleShellSidebar } from './ModuleShellSidebar';
import { OfflineBanner } from './OfflineBanner';
import cls from './ModuleShell.module.scss';

const COLLAPSE_KEY = 'krasterisk.moduleShell.collapsed';
const EMPTY_PAGES: ModulePageDef[] = [];

interface ModuleShellProps {
  children?: ReactNode;
}

/**
 * In-module shell - A+C hybrid:
 * full-width topbar (logo inert, Module▾ → Page▾ menus) → sidebar | content.
 * Sidebar footer «Модули» → Hub. Phone: top-left section menu and bottom page navigation.
 */
export const ModuleShell = memo(function ModuleShell({ children }: ModuleShellProps) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile(768);
  const isCompact = useIsMobile(1024);
  const user = useAppSelector((s) => s.auth.user);
  const accessToken = useAppSelector((s) => s.auth.accessToken);
  const panelMode = useAppSelector((s) => s.aiChat.panelMode) ?? 'dock';
  const chatSeed = useAppSelector((s) => s.aiChat.seedMessage);
  const ccAgent = useAppSelector(selectMyAgent);
  const level = user?.level as UserLevel | undefined;
  const { active, marketplace, navigation, isLoading, isError } = useHubModules();
  useModuleLicenseGate();

  const [isDark, setIsDark] = useState(() => { try { return localStorage.getItem('theme') !== 'light'; } catch { return !document.documentElement.classList.contains('light'); } });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [agentMinimized, setAgentMinimized] = useState(false);
  const agentTriggerRef = useRef<HTMLButtonElement>(null);
  const paletteReturnFocus = useRef<HTMLElement | null>(null);
  const openPalette = useCallback(() => {
    paletteReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPaletteOpen(true);
  }, []);
  const shortcutMod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';
  const agentShortcutHint = t('aiChat.shortcutHint', { mod: shortcutMod });
  const searchShortcutHint = `${t('commandPalette.placeholder')} (${shortcutMod}+K)`;
  const [collapsed, setCollapsed] = useState<boolean | null>(() => {
    try {
      const stored = localStorage.getItem(COLLAPSE_KEY);
      return stored === '1' ? true : stored === '0' ? false : null;
    } catch {
      return null;
    }
  });
  const effectiveCollapsed = collapsed ?? isCompact;

  const navModules = useMemo(() => navigation ?? [...active, ...marketplace], [navigation, active, marketplace]);
  const getDestination = useNavigationHistory(navModules, !isLoading && !isError, readImpersonation(accessToken)?.tenantId);
  const isHub = location.pathname === '/modules' || location.pathname.startsWith('/modules/');
  const currentModule = isHub ? undefined : findModuleByPath(location.pathname, navModules);
  const hubRow = currentModule
    ? active.find((m) => m.code === currentModule.code)
    : undefined;

  const inModuleNav =
    !!currentModule && !isHub && currentModule.code !== 'overview';
  const showSidebar = inModuleNav && !isMobile;

  const pageSource = hubRow?.pages ?? currentModule?.pages ?? EMPTY_PAGES;
  const navPages = useMemo(() => inModuleNav && currentModule
    ? filterPagesByLevel(pageSource, level) : [], [inModuleNav, currentModule, pageSource, level]);

  const currentPage = inModuleNav ? findPageByPath(location.pathname, navPages) : undefined;

  const moduleTitle = useMemo(() => {
    if (!currentModule) return t('hub.catalog');
    if (currentModule.code === 'overview') {
      return t('nav.dashboard');
    }
    return t(hubRow?.labelKey ?? currentModule.labelKey);
  }, [currentModule, hubRow, t]);

  const licensedModules = useMemo(
    () => navModules.filter((m) => m.licenseStatus === 'active' && filterPagesByLevel(m.pages, level).length > 0),
    [navModules, level],
  );

  const moduleMenuItems = useMemo(
    () =>
      [...licensedModules.map((m) => ({
        id: m.code,
        label: t(m.labelKey),
        to: getDestination(m),
      })), { id: 'hub', label: t('hub.title'), to: '/modules' }],
    [licensedModules, getDestination, t],
  );

  const pageMenuItems = useMemo(
    () =>
      navPages.map((p) => ({
        id: p.id,
        label: t(p.labelKey),
        to: p.path,
      })),
    [navPages, t],
  );

  const paletteItems = useMemo(() => {
    const licensed = [...licensedModules.map((m) => ({
      code: m.code,
      label: t(m.labelKey),
      entryPath: getDestination(m),
    })), { code: 'hub', label: t('hub.title'), entryPath: '/modules' }];

    const pages = licensedModules.flatMap((m) => filterPagesByLevel(m.pages, level).map((p) => ({
      id: m.code + ':' + p.id, label: t(p.labelKey), path: p.path, section: t(m.labelKey),
    })));

    return buildPaletteItems(licensed, pages);
  }, [licensedModules, level, getDestination, t]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'k') return;
      if (!(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      if (!paletteOpen) openPalette(); else setPaletteOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openPalette, paletteOpen]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'j') return;
      if (!(e.metaKey || e.ctrlKey) || !e.shiftKey) return;
      e.preventDefault();
      setAgentOpen((open) => agentMinimized || !open);
      setAgentMinimized(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [agentMinimized]);

  useEffect(() => {
    if (chatSeed) { setAgentOpen(true); setAgentMinimized(false); }
  }, [chatSeed]);

  const closeAgent = useCallback(() => {
    setAgentOpen(false);
    agentTriggerRef.current?.focus();
  }, []);

  const handlePanelModeChange = useCallback((next: AssistantPanelMode) => {
    dispatch(aiChatActions.setPanelMode(next));
  }, [dispatch]);

  const handleCollapsedChange = (next: boolean) => {
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
    } catch {
      /* ignore */
    }
  };

  const toggleTheme = () => {
    const html = document.documentElement;
    if (isDark) {
      html.classList.remove('dark');
      html.classList.add('light');
      try { localStorage.setItem('theme', 'light'); } catch { /* Keep the applied theme. */ }
    } else {
      html.classList.remove('light');
      html.classList.add('dark');
      try { localStorage.setItem('theme', 'dark'); } catch { /* Keep the applied theme. */ }
    }
    setIsDark(!isDark);
  };

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language.startsWith('ru') ? 'en' : 'ru');
  };

  return (
    <ModuleDestinationProvider value={getDestination}>
    <ConferenceSessionProvider>
    <Flex direction="column" align="stretch"
      className={cls.shellRoot}
      data-testid="module-shell"
      data-sidebar-collapsed={!isMobile && effectiveCollapsed ? 'true' : 'false'}
      data-phone-sidebar={isMobile ? 'hidden' : undefined}
    >
      <OfflineBanner />

      <Flex as="header" className={cls.topbar}>
        <Flex className={cls.logo} id="shell-logo" aria-hidden="true">
          <Flex className={cls.logoBox} justify="center">
            <Phone size={18} aria-hidden />
          </Flex>
          <Text as="span" className={cls.logoText}>
            Krasterisk
          </Text>
        </Flex>

        {isMobile ? (
          <MobileModuleMenu />
        ) : isHub ? (
          <ModuleBreadcrumbs hubLabel={t('hub.title')} />
        ) : (
          <ModuleBreadcrumbs
            moduleLabel={moduleTitle}
            moduleCurrent={!!currentModule}
            moduleItems={moduleMenuItems}
            pageLabel={currentPage ? t(currentPage.labelKey) : undefined}
            pageItems={pageMenuItems.length > 0 ? pageMenuItems : undefined}
          />
        )}

        <Flex className={cls.spacer} />

        <ConferenceMiniPanel />

        <Tooltip content={agentShortcutHint}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            id="shell-agent-trigger"
            ref={agentTriggerRef}
            className={agentOpen && !agentMinimized ? cls.agentTriggerActive : undefined}
            onClick={() => { setAgentOpen((open) => agentMinimized || !open); setAgentMinimized(false); }}
            aria-label={t('aiChat.openAssistant')}
            aria-pressed={agentOpen && !agentMinimized}
          >
            <Sparkles size={16} aria-hidden />
          </Button>
        </Tooltip>

        <Tooltip content={searchShortcutHint}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              id="shell-cmdk-trigger"
              onClick={openPalette}
              aria-label={t('commandPalette.placeholder')}
            >
              <Search size={16} aria-hidden />
            </Button>
          </Tooltip>

        {!isMobile && <Button
          id="shell-lang-toggle"
          variant="ghost"
          size="icon"
          onClick={toggleLanguage}
          aria-label={t('auth.switchLanguage', { language: i18n.language.startsWith('ru') ? 'EN' : 'RU' })}
          title={t('auth.switchLanguage', { language: i18n.language.startsWith('ru') ? 'EN' : 'RU' })}
        >
          <Languages size={16} aria-hidden />
        </Button>}

        {!isMobile && <Button id="shell-theme-toggle" variant="ghost" size="icon" onClick={toggleTheme}
          aria-label={t(isDark ? 'auth.themeToLight' : 'auth.themeToDark')} title={t(isDark ? 'auth.themeToLight' : 'auth.themeToDark')}>
          {isDark ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
        </Button>}

        <HStack gap="8" align="center">
          <UserBlock
            className={cls.userTrigger}
            preferences={isMobile ? {
              themeLabel: t(isDark ? 'auth.themeToLight' : 'auth.themeToDark'),
              languageLabel: t('auth.switchLanguage', { language: i18n.language.startsWith('ru') ? 'EN' : 'RU' }),
              onThemeChange: toggleTheme, onLanguageChange: toggleLanguage,
            } : undefined}
            displayName={ccAgent ? agentDisplayName(ccAgent) : undefined}
            secondaryLine={
              ccAgent
                ? interfaceToExtension(ccAgent.interface)
                : user?.exten
                  ? `ext. ${user.exten}`
                  : null
            }
          />
        </HStack>
      </Flex>

      <Flex align="stretch" className={cls.body}>
        {showSidebar && currentModule && (
          <ModuleShellSidebar
            moduleTitle={moduleTitle}
            pages={navPages}
            collapsed={effectiveCollapsed}
            onCollapsedChange={handleCollapsedChange}
          />
        )}
        <Flex as="main" direction="column" align="stretch" className={cls.main} tabIndex={-1}>{children}</Flex>
      </Flex>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        items={paletteItems}
        returnFocusRef={paletteReturnFocus}
      />

      <AssistantPanel
        open={agentOpen}
        minimized={agentMinimized}
        onMinimizedChange={setAgentMinimized}
        mode={panelMode}
        onModeChange={handlePanelModeChange}
        onClose={closeAgent}
        onOpen={() => setAgentOpen(true)}
      />
    </Flex>
    </ConferenceSessionProvider>
    </ModuleDestinationProvider>
  );
});
