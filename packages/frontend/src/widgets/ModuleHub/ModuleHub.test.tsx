import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LayoutDashboard, Phone } from 'lucide-react';
import type { HubModuleRow } from '@/features/modules/types';

vi.mock('@/features/modules/hooks/useHubModules', () => ({
  useHubModules: vi.fn(),
}));

vi.mock('@/features/modules/ui/CheckoutSheet/CheckoutSheet', () => ({
  CheckoutSheet: () => null,
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppSelector: (sel: (s: { auth: { user: { level: number } } }) => unknown) =>
    sel({ auth: { user: { level: 1 } } }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string> | string) => {
      if (typeof opts === 'object' && opts?.name) return `Open ${opts.name}`;
      return key;
    },
  }),
}));

import { useHubModules } from '@/features/modules/hooks/useHubModules';
import { ModuleHub } from './ModuleHub';

const activeRow: HubModuleRow = {
  code: 'core',
  kind: 'base',
  navVariant: 'tabs',
  labelKey: 'nav.pbx',
  licenseStatus: 'active',
  favorite: false,
  pages: [{ id: 'endpoints', path: '/endpoints', labelKey: 'endpoints.title', icon: Phone }],
};

const lockedRow: HubModuleRow = {
  code: 'ai',
  kind: 'market',
  navVariant: 'tabs',
  labelKey: 'nav.ai',
  licenseStatus: 'locked',
  favorite: false,
  pages: [{ id: 'ai-agents', path: '/ai-agents', labelKey: 'nav.aiAgents', icon: LayoutDashboard }],
};

describe('ModuleHub (002-E)', () => {
  beforeEach(() => {
    vi.mocked(useHubModules).mockReturnValue({
      active: [activeRow],
      marketplace: [lockedRow],
      isLoading: false,
      favoriteCodes: [],
      toggleFavorite: vi.fn(),
      isFavorite: () => false,
    });
  });

  it('renders Active + Marketplace sections without bento/dock markup', () => {
    const { container } = render(
      <MemoryRouter>
        <ModuleHub />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('module-hub')).toBeInTheDocument();
    expect(screen.getByTestId('hub-active-list')).toBeInTheDocument();
    expect(screen.getByTestId('hub-marketplace-list')).toBeInTheDocument();
    expect(screen.getByText('hub.activeSection')).toBeInTheDocument();
    expect(screen.getByText('hub.marketplaceSection')).toBeInTheDocument();
    expect(screen.getByText('marketplace.buy')).toBeInTheDocument();

    // No bento / dock chrome
    expect(container.querySelector('[data-bento]')).toBeNull();
    expect(container.querySelector('[data-dock]')).toBeNull();
    expect(container.innerHTML).not.toMatch(/bento|orbit|dock/i);
  });

  it('Marketplace section only lists locked modules', () => {
    render(
      <MemoryRouter>
        <ModuleHub />
      </MemoryRouter>,
    );
    const market = screen.getByTestId('hub-marketplace-list');
    expect(market.textContent).toContain('license.locked');
    expect(market.querySelector('#hub-buy-ai')).toBeTruthy();
  });
});
