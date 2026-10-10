import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
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

function Location() { return <output data-testid='location'>{useLocation().pathname}</output>; }
function renderMenu(path = '/endpoints') {
  render(<MemoryRouter initialEntries={[path]}><MobileModuleMenu /><Location /></MemoryRouter>);
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
    expect(screen.getByTestId('phone-module-core')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'endpoints.title' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'nav.trunks' })).toHaveAttribute('href', '/trunks');
    expect(screen.queryByRole('link', { name: 'nav.ivrs' })).toBeNull();
    const trigger = screen.getByTestId('phone-module-apps');
    expect(document.getElementById(trigger.getAttribute('aria-controls')!)).toHaveAttribute('hidden');
    expect(screen.getByTestId('phone-module-apps')).toHaveTextContent('nav.apps');
    expect(screen.getByTestId('phone-module-ai')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'hub.catalog' })).toBeInTheDocument();
  });

  it('expands a section then navigates to the selected page and updates the bottom pages', () => {
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
    expect(screen.queryByTestId('ivrs-page')).toBeNull();
    expect(screen.getByTestId('phone-module-menu')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('phone-module-page-apps-ivrs'));
    expect(screen.getByTestId('ivrs-page')).toBeInTheDocument();
    expect(screen.queryByTestId('phone-module-menu')).toBeNull();
    expect(screen.getByTestId('bottom-bar-section')).toHaveTextContent('nav.apps');
    expect(screen.getByTestId('bottom-bar-page-ivrs')).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByTestId('bottom-bar-page-endpoints')).toBeNull();
  });

  it('hides forbidden pages and sections with no pages permitted for the current role', () => {
    userLevel = UserLevel.OPERATOR;
    vi.mocked(useHubModules).mockReturnValue({
      active: [{ ...core, pages: [core.pages[0], {...core.pages[1], minLevels: [UserLevel.ADMIN]}] }, { ...apps, code: 'restricted', pages: [{ ...apps.pages[0], minLevels: [UserLevel.ADMIN] }] }],
      marketplace: [], isLoading: false, suppressedCodes: [], favoriteCodes: [],
      toggleFavorite: vi.fn(), isFavorite: () => false,
    });
    renderMenu();
    expect(screen.getByTestId('phone-module-core')).toBeInTheDocument();
    expect(screen.queryByTestId('phone-module-restricted')).toBeNull();
    expect(screen.queryByTestId('phone-module-page-core-trunks')).toBeNull();
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
    expect(screen.getByTestId('phone-module-' + code)).toHaveAttribute('href', '/modules?module=' + code);
    expect(screen.queryByTestId('phone-module-page-ai-ai-agents')).toBeNull();
    expect(screen.queryByTestId('phone-module-page-disabled-ivrs')).toBeNull();
    fireEvent.click(screen.getByTestId('phone-module-' + code));
    expect(screen.getByTestId('hub-page')).toBeInTheDocument();
  });


  it('toggles multiple sections without navigation and hides collapsed links', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: 'nav.apps' }));
    expect(screen.getByRole('link', { name: 'nav.ivrs' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'nav.trunks' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/endpoints');
    fireEvent.click(screen.getByRole('button', { name: 'nav.pbx' }));
    expect(screen.queryByRole('link', { name: 'nav.trunks' })).toBeNull();
    expect(screen.getByRole('link', { name: 'nav.ivrs' })).toBeInTheDocument();
    expect(screen.getByTestId('phone-module-menu')).toBeInTheDocument();
  });

  it('navigates directly to a non-first page and closes', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('link', { name: 'nav.trunks' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/trunks');
    expect(screen.queryByTestId('phone-module-menu')).toBeNull();
  });

  it('reopens the current section automatically', async () => {
    const user = userEvent.setup(); renderMenu();
    await user.click(screen.getByRole('button', { name: 'nav.pbx' }));
    await user.keyboard('{Escape}');
    await user.click(screen.getByTestId('phone-module-menu-trigger'));
    expect(screen.getByRole('button', { name: 'nav.pbx' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('marks only the most-specific page of a nested route', () => {
    vi.mocked(useHubModules).mockReturnValue({ active: [{ ...core, pages: [
      { ...core.pages[0], id: 'settings', path: '/settings', labelKey: 'nav.settings' },
      { ...core.pages[0], id: 'stt', path: '/settings/stt-engines', labelKey: 'nav.stt' },
    ] }], marketplace: [], isLoading: false, suppressedCodes: [], favoriteCodes: [], toggleFavorite: vi.fn(), isFavorite: () => false });
    renderMenu('/settings/stt-engines/7');
    const current = screen.getByTestId('phone-module-menu').querySelectorAll('[aria-current=page]');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAttribute('href', '/settings/stt-engines');
  });

  it('preserves modified link clicks with the Sheet open', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('link', { name: 'nav.trunks' }), { ctrlKey: true });
    expect(screen.getByTestId('location')).toHaveTextContent('/endpoints');
    expect(screen.getByTestId('phone-module-menu')).toBeInTheDocument();
  });

  it('expands and collapses with Enter and Space', async () => {
    const user = userEvent.setup(); renderMenu();
    screen.getByRole('button', { name: 'nav.apps' }).focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('link', { name: 'nav.ivrs' })).toBeInTheDocument();
    await user.keyboard(' ');
    expect(screen.queryByRole('link', { name: 'nav.ivrs' })).toBeNull();
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
  renderMenu();const links=screen.getByRole('navigation',{name:'hub.catalog'}).querySelectorAll('a,button');
  expect(links[0]).toHaveAttribute('data-testid','phone-module-core');expect(links[links.length-1]).toHaveAttribute('data-testid','phone-module-hub');
  expect(screen.getByTestId('phone-module-ai')).toHaveAttribute('href','/modules?module=ai');expect(screen.getByTestId('phone-module-ai')).toHaveTextContent('hub.notConnected');
 });
});
