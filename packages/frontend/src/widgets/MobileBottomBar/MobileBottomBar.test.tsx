import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Phone } from 'lucide-react';
import type { HubModuleRow } from '@/features/modules/types';

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
  pages: [{ id: 'endpoints', path: '/endpoints', labelKey: 'endpoints.title', icon: Phone }],
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
    {
      id: 'cc-agent',
      path: '/callcenter/agent',
      labelKey: 'nav.operator',
      icon: Phone,
    },
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

describe('MobileBottomBar (004-B)', () => {
  beforeEach(() => {
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

  it('renders five items with More from i18n', () => {
    render(
      <MemoryRouter>
        <MobileBottomBar />
      </MemoryRouter>,
    );

    const bar = screen.getByTestId('mobile-bottom-bar');
    expect(bar).toBeInTheDocument();

    expect(screen.getByTestId('bottom-bar-hub')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-bar-core')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-bar-apps')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-bar-system')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-bar-more')).toHaveTextContent('hub.more');
  });

  it('marks active module item with primary accent class', () => {
    render(
      <MemoryRouter initialEntries={['/endpoints']}>
        <MobileBottomBar />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('bottom-bar-core').className).toMatch(/active/);
    expect(screen.getByTestId('bottom-bar-hub').className).not.toMatch(/active/);
  });

  it('More opens sheet with remaining licensed modules (not primary five)', () => {
    render(
      <MemoryRouter>
        <MobileBottomBar />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId('bottom-bar-more'));
    expect(screen.getByTestId('bottom-bar-more-sheet')).toBeInTheDocument();
    expect(screen.getByText('nav.callcenter')).toBeInTheDocument();
  });
});
