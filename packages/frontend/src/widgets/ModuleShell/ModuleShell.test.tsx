import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Phone } from 'lucide-react';
import type { HubModuleRow } from '@/features/modules/types';

const useIsMobileMock = vi.fn((_bp?: number) => false);

vi.mock('@/shared/hooks/useIsMobile', () => ({
  useIsMobile: (bp?: number) => useIsMobileMock(bp),
}));

vi.mock('@/features/modules/hooks/useHubModules', () => ({
  useHubModules: vi.fn(),
}));

vi.mock('@/features/modules/hooks/useModuleLicenseGate', () => ({
  useModuleLicenseGate: vi.fn(),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppSelector: (sel: (s: { auth: { user: { name: string; level: number } } }) => unknown) =>
    sel({ auth: { user: { name: 'Admin', level: 1 } } }),
  useAppDispatch: () => vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

import { useHubModules } from '@/features/modules/hooks/useHubModules';
import { ModuleShell } from './ModuleShell';

const coreRow: HubModuleRow = {
  code: 'core',
  kind: 'base',
  navVariant: 'sidebar',
  labelKey: 'nav.pbx',
  licenseStatus: 'active',
  favorite: false,
  pages: [
    { id: 'endpoints', path: '/endpoints', labelKey: 'endpoints.title', icon: Phone },
    { id: 'trunks', path: '/trunks', labelKey: 'nav.trunks', icon: Phone },
  ],
};

const appsRow: HubModuleRow = {
  code: 'apps',
  kind: 'base',
  navVariant: 'sidebar',
  labelKey: 'nav.apps',
  licenseStatus: 'active',
  favorite: false,
  pages: [],
};

describe('ModuleShell (A+C hybrid)', () => {
  beforeEach(() => {
    useIsMobileMock.mockReturnValue(false);
    vi.mocked(useHubModules).mockReturnValue({
      active: [coreRow, appsRow],
      marketplace: [],
      isLoading: false,
      favoriteCodes: [],
      toggleFavorite: vi.fn(),
      isFavorite: () => false,
    });
  });

  it('shows module▾/page▾ crumbs, inert logo, sidebar; no Home crumb', () => {
    render(
      <MemoryRouter initialEntries={['/endpoints']}>
        <Routes>
          <Route
            path="/endpoints"
            element={
              <ModuleShell>
                <div>page</div>
              </ModuleShell>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('module-shell-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-module-title')).toBeInTheDocument();
    const crumbs = screen.getByTestId('module-breadcrumbs');
    expect(within(crumbs).queryByText('hub.home')).toBeNull();
    expect(screen.getByTestId('crumb-module')).toBeInTheDocument();
    expect(screen.getByTestId('crumb-page')).toHaveTextContent('endpoints.title');
    expect(screen.queryByTestId('module-shell-tabs')).toBeNull();
    expect(screen.getByTestId('module-shell').querySelector('#shell-logo')?.tagName).toBe(
      'DIV',
    );
    expect(screen.getByTestId('module-shell').querySelector('#shell-logo a')).toBeNull();
  });

  it('opens module switcher menu from module crumb', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    render(
      <MemoryRouter initialEntries={['/endpoints']}>
        <ModuleShell>
          <div>page</div>
        </ModuleShell>
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId('crumb-module'));
    expect(await screen.findByTestId('crumb-module-menu')).toBeInTheDocument();
    expect(within(screen.getByTestId('crumb-module-menu')).getByText('nav.apps')).toBeInTheDocument();
  });

  it('navigates to Module Hub from sidebar Модули', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    render(
      <MemoryRouter initialEntries={['/endpoints']}>
        <Routes>
          <Route
            path="/endpoints"
            element={
              <ModuleShell>
                <div>page</div>
              </ModuleShell>
            }
          />
          <Route path="/modules" element={<div data-testid="hub-page">hub</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId('sidebar-modules-trigger'));
    expect(await screen.findByTestId('hub-page')).toBeInTheDocument();
  });

  it('hides sidebar on Hub', () => {
    render(
      <MemoryRouter initialEntries={['/modules']}>
        <ModuleShell>
          <div>hub</div>
        </ModuleShell>
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('module-shell-sidebar')).toBeNull();
    expect(screen.getByTestId('module-breadcrumbs')).toHaveTextContent('hub.title');
  });

  it('auto-collapses sidebar on phone', () => {
    useIsMobileMock.mockReturnValue(true);
    render(
      <MemoryRouter initialEntries={['/endpoints']}>
        <ModuleShell>
          <div>page</div>
        </ModuleShell>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('module-shell-sidebar')).toHaveAttribute(
      'data-collapsed',
      'true',
    );
    expect(screen.queryByTestId('sidebar-collapse')).toBeNull();
  });

  it('toggles collapse on desktop', () => {
    render(
      <MemoryRouter initialEntries={['/endpoints']}>
        <ModuleShell>
          <div>page</div>
        </ModuleShell>
      </MemoryRouter>,
    );
    const sidebar = screen.getByTestId('module-shell-sidebar');
    expect(sidebar).toHaveAttribute('data-collapsed', 'false');
    fireEvent.click(screen.getByTestId('sidebar-collapse'));
    expect(sidebar).toHaveAttribute('data-collapsed', 'true');
  });

  it('opens CommandPalette on Ctrl+K', () => {
    render(
      <MemoryRouter initialEntries={['/endpoints']}>
        <ModuleShell />
      </MemoryRouter>,
    );
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.getByTestId('command-palette')).toBeInTheDocument();
  });

  it('mounts offline banner', () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => false,
    });
    render(
      <MemoryRouter initialEntries={['/endpoints']}>
        <ModuleShell />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('offline-banner')).toBeInTheDocument();
  });
});
