import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Phone } from 'lucide-react';
import type { HubModuleRow } from '@/features/modules/types';

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
  navVariant: 'tabs',
  labelKey: 'nav.pbx',
  licenseStatus: 'active',
  favorite: false,
  pages: [
    { id: 'endpoints', path: '/endpoints', labelKey: 'endpoints.title', icon: Phone },
    { id: 'trunks', path: '/trunks', labelKey: 'nav.trunks', icon: Phone },
  ],
};

describe('ModuleShell (003-B)', () => {
  beforeEach(() => {
    vi.mocked(useHubModules).mockReturnValue({
      active: [coreRow],
      marketplace: [],
      isLoading: false,
      favoriteCodes: [],
      toggleFavorite: vi.fn(),
      isFavorite: () => false,
    });
  });

  it('logo navigates to /modules and tabs render for current module', () => {
    render(
      <MemoryRouter initialEntries={['/endpoints']}>
        <Routes>
          <Route path="/endpoints" element={<ModuleShell />} />
          <Route path="/modules" element={<ModuleShell />} />
        </Routes>
      </MemoryRouter>,
    );

    const logo = screen.getByTestId('module-shell').querySelector('#shell-logo');
    expect(logo).toBeTruthy();
    expect(logo?.getAttribute('href')).toBe('/modules');

    expect(screen.getByTestId('module-shell-tabs')).toBeInTheDocument();
    expect(screen.getByText('endpoints.title')).toBeInTheDocument();
    expect(screen.getByText('nav.trunks')).toBeInTheDocument();
  });

  it('does not invent product tabs on Hub or Overview', () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/modules']}>
        <ModuleShell />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('module-shell-tabs')).toBeNull();
    unmount();

    render(
      <MemoryRouter initialEntries={['/']}>
        <ModuleShell />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('module-shell-tabs')).toBeNull();
  });

  it('opens CommandPalette on Ctrl+K (D-06)', () => {
    render(
      <MemoryRouter initialEntries={['/endpoints']}>
        <ModuleShell />
      </MemoryRouter>,
    );

    expect(screen.queryByTestId('command-palette')).toBeNull();
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.getByTestId('command-palette')).toBeInTheDocument();
  });
});

