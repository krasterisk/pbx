import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Phone } from 'lucide-react';
import { UserLevel } from '@krasterisk/shared';
import type { HubModuleRow } from '@/features/modules/types';

let userLevel: UserLevel = UserLevel.ADMIN;
vi.mock('@/features/modules/hooks/useHubModules', () => ({ useHubModules: vi.fn() }));
vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppSelector: (sel: (s: { auth: { user: { level: UserLevel } } }) => unknown) =>
    sel({ auth: { user: { level: userLevel } } }),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import { useHubModules } from '@/features/modules/hooks/useHubModules';
import { MobileModuleMenu } from './MobileModuleMenu';
import { MobileBottomBar } from '@/widgets/MobileBottomBar';

const core: HubModuleRow = {
  code: 'core', kind: 'base', navVariant: 'sidebar', labelKey: 'nav.pbx',
  licenseStatus: 'active', favorite: false,
  pages: [
    { id: 'endpoints', path: '/endpoints', labelKey: 'endpoints.title', icon: Phone },
    { id: 'trunks', path: '/trunks', labelKey: 'nav.trunks', icon: Phone },
  ],
};
const apps: HubModuleRow = {
  ...core, code: 'apps', labelKey: 'nav.apps',
  pages: [{ id: 'ivrs', path: '/ivrs', labelKey: 'nav.ivrs', icon: Phone }],
};
const locked: HubModuleRow = {
  ...core, code: 'ai', labelKey: 'nav.ai', kind: 'market', licenseStatus: 'locked',
  pages: [{ id: 'ai-agents', path: '/ai-agents', labelKey: 'nav.aiAgents', icon: Phone }],
};

function renderMenu() {
  render(<MemoryRouter initialEntries={['/endpoints']}><MobileModuleMenu /></MemoryRouter>);
  fireEvent.click(screen.getByTestId('phone-module-menu-trigger'));
}

describe('MobileModuleMenu left Sheet', () => {
  beforeEach(() => {
    userLevel = UserLevel.ADMIN;
    vi.mocked(useHubModules).mockReturnValue({
      active: [core, apps, { ...apps, code: 'disabled', licenseStatus: 'disabled' }],
      marketplace: [locked], isLoading: false, suppressedCodes: [], favoriteCodes: [],
      toggleFavorite: vi.fn(), isFavorite: () => false,
    });
  });

  it('opens a left side menu with section entries and no search field', () => {
    renderMenu();
    expect(screen.getByTestId('phone-module-menu-trigger')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('phone-module-menu')).toHaveAttribute('data-side', 'left');
    expect(screen.queryByRole('textbox')).toBeNull();
    const menuItems = screen.getByRole('navigation', { name: 'hub.catalog' }).querySelectorAll('a');
    expect(menuItems[menuItems.length - 1]).toHaveAttribute('data-testid', 'phone-module-hub');
    expect(screen.getByTestId('phone-module-core')).toHaveAttribute('aria-current', 'true');
    expect(screen.getByTestId('phone-module-apps')).toHaveTextContent('nav.apps');
    expect(screen.getByTestId('phone-module-ai')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'hub.catalog' })).toBeInTheDocument();
  });

  it('switches section in one click and updates the bottom pages', () => {
    window.innerWidth = 390;
    render(
      <MemoryRouter initialEntries={['/endpoints']}>
        <MobileModuleMenu /><MobileBottomBar />
        <Routes>
          <Route path="/endpoints" element={<div>Endpoints</div>} />
          <Route path="/ivrs" element={<div data-testid="ivrs-page">IVR</div>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('phone-module-menu-trigger'));
    fireEvent.click(screen.getByTestId('phone-module-apps'));
    expect(screen.getByTestId('ivrs-page')).toBeInTheDocument();
    expect(screen.queryByTestId('phone-module-menu')).toBeNull();
    expect(screen.getByTestId('bottom-bar-section')).toHaveTextContent('nav.apps');
    expect(screen.getByTestId('bottom-bar-page-ivrs')).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByTestId('bottom-bar-page-endpoints')).toBeNull();
  });

  it('hides sections with no pages permitted for the current role', () => {
    userLevel = UserLevel.OPERATOR;
    vi.mocked(useHubModules).mockReturnValue({
      active: [core, { ...apps, code: 'restricted', pages: [{ ...apps.pages[0], minLevels: [UserLevel.ADMIN] }] }],
      marketplace: [], isLoading: false, suppressedCodes: [], favoriteCodes: [],
      toggleFavorite: vi.fn(), isFavorite: () => false,
    });
    renderMenu();
    expect(screen.getByTestId('phone-module-core')).toBeInTheDocument();
    expect(screen.queryByTestId('phone-module-restricted')).toBeNull();
  });

  it.each(['ai', 'disabled'])('sends unavailable section %s to Hub', (code) => {
    render(
      <MemoryRouter initialEntries={['/endpoints']}>
        <MobileModuleMenu />
        <Routes>
          <Route path="/endpoints" element={<div>Endpoints</div>} />
          <Route path="/modules" element={<div data-testid="hub-page">Hub</div>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('phone-module-menu-trigger'));
    fireEvent.click(screen.getByTestId(`phone-module-${code}`));
    expect(screen.getByTestId('hub-page')).toBeInTheDocument();
  });

  it('closes on Escape and restores focus to the hamburger', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('phone-module-menu')).toBeNull();
    expect(screen.getByTestId('phone-module-menu-trigger')).toHaveFocus();
    await user.click(screen.getByTestId('phone-module-menu-trigger'));
    expect(screen.getByTestId('phone-module-apps')).toBeInTheDocument();
  });
});

describe('stable section menu and unavailable context',()=>{
 it('uses canonical navigation order, keeps Hub last and names the locked status',()=>{
  userLevel=UserLevel.ADMIN;vi.mocked(useHubModules).mockReturnValue({navigation:[core,apps,locked],active:[apps,core],marketplace:[locked],isLoading:false,suppressedCodes:[],favoriteCodes:[],toggleFavorite:vi.fn(),isFavorite:()=>false});
  renderMenu();const links=screen.getByRole('navigation',{name:'hub.catalog'}).querySelectorAll('a');
  expect(links[0]).toHaveAttribute('data-testid','phone-module-core');expect(links[links.length-1]).toHaveAttribute('data-testid','phone-module-hub');
  expect(screen.getByTestId('phone-module-ai')).toHaveAttribute('href','/modules?module=ai');expect(screen.getByTestId('phone-module-ai')).toHaveTextContent('hub.notConnected');
 });
});
