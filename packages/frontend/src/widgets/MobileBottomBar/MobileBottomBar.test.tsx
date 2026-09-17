import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Phone } from 'lucide-react';
import type { HubModuleRow } from '@/features/modules/types';
import { MOBILE_NAV_STORAGE_KEY } from '@/features/modules/lib/mobileNavRecents';

const useIsMobileMock = vi.fn((_bp?: number) => true);

vi.mock('@/shared/hooks/useIsMobile', () => ({
  useIsMobile: (bp?: number) => useIsMobileMock(bp),
}));

vi.mock('@/features/modules/hooks/useHubModules', () => ({
  useHubModules: vi.fn(),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppSelector: (sel: (s: { auth: { user: { level: number } } }) => unknown) =>
    sel({ auth: { user: { level: 1 } } }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

import { useHubModules } from '@/features/modules/hooks/useHubModules';
import { MobileBottomBar } from './MobileBottomBar';

const coreRow: HubModuleRow = {
  code: 'core',
  kind: 'base',
  navVariant: 'tabs',
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
  navVariant: 'tabs',
  labelKey: 'nav.apps',
  licenseStatus: 'active',
  favorite: false,
  pages: [{ id: 'ivrs', path: '/ivrs', labelKey: 'nav.ivrs', icon: Phone }],
};

const systemRow: HubModuleRow = {
  code: 'system',
  kind: 'base',
  navVariant: 'tabs',
  labelKey: 'nav.system',
  licenseStatus: 'active',
  favorite: false,
  pages: [{ id: 'users', path: '/users', labelKey: 'nav.users', icon: Phone }],
};

const callcenterRow: HubModuleRow = {
  code: 'callcenter',
  kind: 'market',
  navVariant: 'tabs',
  labelKey: 'nav.callcenter',
  licenseStatus: 'active',
  favorite: false,
  pages: [
    { id: 'cc-agent', path: '/callcenter/agent', labelKey: 'nav.operator', icon: Phone },
    { id: 'cc-supervisor', path: '/callcenter/supervisor', labelKey: 'nav.supervisor', icon: Phone },
  ],
};

const lockedAi: HubModuleRow = {
  code: 'ai',
  kind: 'market',
  navVariant: 'tabs',
  labelKey: 'nav.ai',
  licenseStatus: 'locked',
  favorite: false,
  pages: [{ id: 'ai-agents', path: '/ai-agents', labelKey: 'nav.aiAgents', icon: Phone }],
};

describe('MobileBottomBar recents + catalog', () => {
  beforeEach(() => {
    localStorage.clear();
    useIsMobileMock.mockReturnValue(true);
    vi.mocked(useHubModules).mockReturnValue({
      active: [coreRow, appsRow, systemRow, callcenterRow],
      marketplace: [lockedAi],
      isLoading: false,
      favoriteCodes: [],
      toggleFavorite: vi.fn(),
      isFavorite: () => false,
    });
  });

  it('hides when width ≥768 (useIsMobile false)', () => {
    useIsMobileMock.mockReturnValue(false);
    const { container } = render(
      <MemoryRouter>
        <MobileBottomBar />
      </MemoryRouter>,
    );
    expect(container.querySelector('[data-testid="mobile-bottom-bar"]')).toBeNull();
    expect(useIsMobileMock).toHaveBeenCalledWith(768);
  });

  it('keeps a static catalog picker and puts hub in the center on the hub route', () => {
    render(
      <MemoryRouter initialEntries={['/modules']}>
        <MobileBottomBar />
      </MemoryRouter>,
    );

    const bar = screen.getByTestId('mobile-bottom-bar');
    expect(bar).toHaveAttribute('data-center-code', 'hub');
    expect(screen.getByTestId('bottom-bar-picker')).toHaveTextContent('hub.catalog');
    expect(screen.getByTestId('bottom-bar-center')).toHaveAttribute('data-code', 'hub');
    expect(screen.getByTestId('bottom-bar-center')).toHaveTextContent('hub.home');
    expect(screen.queryByTestId('bottom-bar-more')).toBeNull();
  });

  it('moves the open module to the center slot', () => {
    render(
      <MemoryRouter initialEntries={['/endpoints']}>
        <MobileBottomBar />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('mobile-bottom-bar')).toHaveAttribute('data-center-code', 'core');
    expect(screen.getByTestId('bottom-bar-center')).toHaveAttribute('data-code', 'core');
    expect(screen.getByTestId('bottom-bar-center').className).toMatch(/active/);
    expect(screen.getByTestId('bottom-bar-center-menu-hint')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-bar-center')).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('opens a searchable catalog of every module from the picker', () => {
    render(
      <MemoryRouter initialEntries={['/modules']}>
        <MobileBottomBar />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId('bottom-bar-picker'));
    expect(screen.getByTestId('bottom-bar-catalog-sheet')).toHaveAttribute('data-nav-view', 'catalog');
    expect(screen.getByTestId('bottom-bar-search')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-bar-catalog-callcenter')).toHaveTextContent('nav.callcenter');
    expect(screen.getByTestId('bottom-bar-catalog-ai')).toBeInTheDocument();
  });

  it('opens the current module pages from the center button', () => {
    render(
      <MemoryRouter initialEntries={['/endpoints']}>
        <MobileBottomBar />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId('bottom-bar-center'));
    expect(screen.getByTestId('bottom-bar-pages-sheet')).toHaveAttribute('data-nav-view', 'pages');
    expect(screen.getByTestId('bottom-bar-page-endpoints')).toHaveTextContent('endpoints.title');
    expect(screen.getByTestId('bottom-bar-page-trunks')).toHaveTextContent('nav.trunks');
  });

  it('navigates to the chosen subsection from the page sheet', () => {
    render(
      <MemoryRouter initialEntries={['/endpoints']}>
        <MobileBottomBar />
        <Routes>
          <Route path="/endpoints" element={<div />} />
          <Route path="/trunks" element={<div data-testid="trunks-page">trunks</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId('bottom-bar-center'));
    fireEvent.click(screen.getByTestId('bottom-bar-page-trunks'));
    expect(screen.getByTestId('trunks-page')).toBeInTheDocument();
  });

  it('drills from catalog into a module page list and back', () => {
    render(
      <MemoryRouter initialEntries={['/modules']}>
        <MobileBottomBar />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId('bottom-bar-picker'));
    fireEvent.click(screen.getByTestId('bottom-bar-catalog-callcenter'));
    expect(screen.getByTestId('bottom-bar-pages-sheet')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-bar-page-cc-agent')).toHaveTextContent('nav.operator');

    fireEvent.click(screen.getByTestId('bottom-bar-nav-back'));
    expect(screen.getByTestId('bottom-bar-catalog-sheet')).toBeInTheDocument();
    expect(screen.getByText('nav.callcenter')).toBeInTheDocument();
  });

  it('finds a page across modules from catalog search', () => {
    render(
      <MemoryRouter initialEntries={['/modules']}>
        <MobileBottomBar />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId('bottom-bar-picker'));
    fireEvent.change(screen.getByTestId('bottom-bar-search'), {
      target: { value: 'endpoints.title' },
    });
    expect(screen.getByTestId('bottom-bar-search-page-endpoints')).toBeInTheDocument();
  });

  it('jumps a neighbor module to its last visited page', () => {
    localStorage.setItem(
      MOBILE_NAV_STORAGE_KEY,
      JSON.stringify({
        codes: ['core', 'hub', 'apps'],
        lastPathByCode: { core: '/trunks', hub: '/modules', apps: '/ivrs' },
      }),
    );

    render(
      <MemoryRouter initialEntries={['/modules']}>
        <MobileBottomBar />
        <Routes>
          <Route path="/modules" element={<div />} />
          <Route path="/trunks" element={<div data-testid="trunks-page">trunks</div>} />
        </Routes>
      </MemoryRouter>,
    );

    const neighbor = screen.getAllByRole('button').find((btn) => btn.getAttribute('data-code') === 'core');
    expect(neighbor).toBeTruthy();
    fireEvent.click(neighbor!);
    expect(screen.getByTestId('trunks-page')).toBeInTheDocument();
  });
});
