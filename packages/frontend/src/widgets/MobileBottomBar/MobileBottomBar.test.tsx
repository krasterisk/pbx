import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Phone } from 'lucide-react';
import { UserLevel } from '@krasterisk/shared';
import type { HubModuleRow } from '@/features/modules/types';

const useIsMobileMock = vi.fn((_bp?: number) => true);
let userLevel: UserLevel = UserLevel.ADMIN;
vi.mock('@/shared/hooks/useIsMobile', () => ({ useIsMobile: (bp?: number) => useIsMobileMock(bp) }));
vi.mock('@/features/modules/hooks/useHubModules', () => ({ useHubModules: vi.fn() }));
vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppSelector: (sel: (s: { auth: { user: { level: UserLevel } } }) => unknown) =>
    sel({ auth: { user: { level: userLevel } } }),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import { useHubModules } from '@/features/modules/hooks/useHubModules';
import { MobileBottomBar } from './MobileBottomBar';

const coreRow: HubModuleRow = {
  code: 'core', kind: 'base', navVariant: 'sidebar', labelKey: 'nav.pbx',
  licenseStatus: 'active', favorite: false,
  pages: [
    { id: 'endpoints', path: '/endpoints', labelKey: 'endpoints.title', icon: Phone },
    { id: 'trunks', path: '/trunks', labelKey: 'nav.trunks', icon: Phone },
  ],
};

const systemRow: HubModuleRow = {
  ...coreRow, code: 'system', labelKey: 'nav.system',
  pages: [
    { id: 'settings', path: '/settings', labelKey: 'nav.settings', icon: Phone },
    { id: 'tts', path: '/settings/tts-engines', labelKey: 'nav.ttsEngines', icon: Phone },
    { id: 'users', path: '/users', labelKey: 'nav.users', icon: Phone, minLevels: [UserLevel.ADMIN] },
  ],
};

function renderAt(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><MobileBottomBar /></MemoryRouter>);
}

function sendPointer(node: HTMLElement, type: string, clientX: number, pointerType = 'mouse') {
  const event = new MouseEvent(type, { bubbles: true, clientX, button: 0 });
  Object.defineProperties(event, { pointerId: { value: 1 }, pointerType: { value: pointerType } });
  fireEvent(node, event);
}

function overflowingStrip() {
  const strip = screen.getByTestId('bottom-bar-pages');
  Object.defineProperties(strip, { scrollWidth: { value: 600 }, clientWidth: { value: 200 } });
  return strip;
}

describe('MobileBottomBar section pages', () => {
  beforeEach(() => {
    useIsMobileMock.mockReturnValue(true);
    userLevel = UserLevel.ADMIN;
    Element.prototype.scrollIntoView = vi.fn();
    vi.mocked(useHubModules).mockReturnValue({
      active: [coreRow, systemRow], marketplace: [], isLoading: false,
      suppressedCodes: [], favoriteCodes: [], toggleFavorite: vi.fn(), isFavorite: () => false,
    });
  });

  it('hides on desktop', () => {
    useIsMobileMock.mockReturnValue(false);
    renderAt('/endpoints');
    expect(screen.queryByTestId('mobile-bottom-bar')).toBeNull();
    expect(useIsMobileMock).toHaveBeenCalledWith(768);
  });

  it('shows section name followed by its pages, without the old catalog and recent slots', () => {
    renderAt('/endpoints');
    expect(screen.getByTestId('bottom-bar-section')).toHaveTextContent('nav.pbx');
    const pages = screen.getByTestId('bottom-bar-pages');
    expect(within(pages).getAllByRole('link')).toHaveLength(2);
    expect(screen.getByTestId('bottom-bar-page-endpoints')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('bottom-bar-page-trunks')).not.toHaveAttribute('aria-current');
    expect(screen.queryByTestId('bottom-bar-picker')).toBeNull();
    expect(screen.queryByTestId('bottom-bar-center')).toBeNull();
    expect(screen.queryByTestId('bottom-bar-page-users')).toBeNull();
  });

  it('navigates directly and updates active page in the same persistent bar', () => {
    render(
      <MemoryRouter initialEntries={['/endpoints']}>
        <MobileBottomBar />
        <Routes>
          <Route path="/endpoints" element={<div>Endpoints</div>} />
          <Route path="/trunks" element={<div data-testid="trunks-page">Trunks</div>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('bottom-bar-page-trunks'));
    expect(screen.getByTestId('trunks-page')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-bar-page-trunks')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('bottom-bar-page-endpoints')).not.toHaveAttribute('aria-current');
  });

  it('marks only the longest matching page on nested routes', () => {
    renderAt('/settings/tts-engines/42');
    expect(screen.getByTestId('bottom-bar-page-tts')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('bottom-bar-page-settings')).not.toHaveAttribute('aria-current');
    expect(within(screen.getByTestId('mobile-bottom-bar')).getAllByRole('link').filter(
      (button) => button.getAttribute('aria-current') === 'page',
    )).toHaveLength(1);
  });

  it('filters restricted pages', () => {
    userLevel = UserLevel.OPERATOR;
    renderAt('/settings');
    expect(screen.queryByTestId('bottom-bar-page-users')).toBeNull();
    expect(screen.getByTestId('bottom-bar-page-settings')).toBeInTheDocument();
  });

  it('retains every page when a section has many pages', () => {
    const manyPages = Array.from({ length: 12 }, (_, i) => ({
      id: `page-${i}`, path: `/page-${i}`, labelKey: `page.${i}`, icon: Phone,
    }));
    vi.mocked(useHubModules).mockReturnValue({
      active: [{ ...coreRow, pages: manyPages }], marketplace: [], isLoading: false,
      suppressedCodes: [], favoriteCodes: [], toggleFavorite: vi.fn(), isFavorite: () => false,
    });
    renderAt('/page-11');
    expect(within(screen.getByTestId('bottom-bar-pages')).getAllByRole('link')).toHaveLength(12);
    expect(screen.getByTestId('bottom-bar-page-page-11')).toHaveAttribute('aria-current', 'page');
  });

  it('reveals a clipped link with minimal scroll on resize and reselection from the Sheet', () => {
    renderAt('/trunks');
    const strip = screen.getByTestId('bottom-bar-pages');
    const selected = screen.getByTestId('bottom-bar-page-trunks');
    Object.defineProperties(strip, { clientWidth: { value: 240 }, scrollWidth: { value: 800 } });
    vi.spyOn(strip, 'getBoundingClientRect').mockImplementation(() => ({ left: 80, right: 320, width: 240 }) as DOMRect);
    vi.spyOn(selected, 'getBoundingClientRect').mockImplementation(() => ({ left: 440 - strip.scrollLeft, right: 520 - strip.scrollLeft, width: 80 }) as DOMRect);
    fireEvent(window, new Event('resize'));
    expect(strip.scrollLeft).toBe(208);
    strip.scrollLeft = 100;
    fireEvent.click(screen.getByTestId('bottom-bar-section-trigger'));
    fireEvent.click(within(screen.getByTestId('bottom-bar-page-menu')).getByRole('link', { name: 'nav.trunks' }));
    expect(strip.scrollLeft).toBe(208);
    expect(screen.queryByTestId('bottom-bar-page-menu')).toBeNull();
    strip.scrollLeft = 50;
    fireEvent.click(selected);
    expect(strip.scrollLeft).toBe(208);
  });

  it('keeps scroll position when the selected link is already visible', () => {
    renderAt('/trunks');
    const strip = screen.getByTestId('bottom-bar-pages');
    Object.defineProperties(strip, { clientWidth: { value: 240 }, scrollWidth: { value: 800 } });
    vi.spyOn(strip, 'getBoundingClientRect').mockReturnValue({ left: 80, right: 320, width: 240 } as DOMRect);
    vi.spyOn(screen.getByTestId('bottom-bar-page-trunks'), 'getBoundingClientRect').mockImplementation(() => ({ left: 220 - strip.scrollLeft, right: 300 - strip.scrollLeft, width: 80 }) as DOMRect);
    strip.scrollLeft = 60;
    fireEvent(window, new Event('resize'));
    expect(strip.scrollLeft).toBe(60);
    fireEvent.click(screen.getByTestId('bottom-bar-page-trunks'));
    expect(strip.scrollLeft).toBe(60);
  });

  it.each([['first', 84, 560, 0], ['last', 800, 0, 560]] as const)(
    'reveals the %s page without scrolling into blank edge space', (_, left, initial, expected) => {
      renderAt('/trunks');
      const strip = screen.getByTestId('bottom-bar-pages');
      Object.defineProperties(strip, { clientWidth: { value: 240 }, scrollWidth: { value: 800 } });
      vi.spyOn(strip, 'getBoundingClientRect').mockReturnValue({ left: 80, right: 320, width: 240 } as DOMRect);
      vi.spyOn(screen.getByTestId('bottom-bar-page-trunks'), 'getBoundingClientRect').mockImplementation(() => ({ left: left - strip.scrollLeft, right: left + 80 - strip.scrollLeft, width: 80 }) as DOMRect);
      strip.scrollLeft = initial;
      fireEvent(window, new Event('resize'));
      expect(strip.scrollLeft).toBe(expected);
    },
  );

  it('moves only as far as needed to reveal a clipped link on the left', () => {
    renderAt('/trunks');
    const strip = screen.getByTestId('bottom-bar-pages');
    Object.defineProperties(strip, { clientWidth: { value: 240 }, scrollWidth: { value: 800 } });
    vi.spyOn(strip, 'getBoundingClientRect').mockReturnValue({ left: 80, right: 320, width: 240 } as DOMRect);
    vi.spyOn(screen.getByTestId('bottom-bar-page-trunks'), 'getBoundingClientRect').mockImplementation(() => ({ left: 240 - strip.scrollLeft, right: 320 - strip.scrollLeft, width: 80 }) as DOMRect);
    strip.scrollLeft = 200;
    fireEvent(window, new Event('resize'));
    expect(strip.scrollLeft).toBe(152);
  });

  it('keeps an oversized link start-aligned instead of oscillating on repeated resize', () => {
    renderAt('/trunks');
    const strip = screen.getByTestId('bottom-bar-pages');
    Object.defineProperties(strip, { clientWidth: { value: 80 }, scrollWidth: { value: 400 } });
    vi.spyOn(strip, 'getBoundingClientRect').mockReturnValue({ left: 80, right: 160, width: 80 } as DOMRect);
    vi.spyOn(screen.getByTestId('bottom-bar-page-trunks'), 'getBoundingClientRect').mockImplementation(() => ({ left: 240 - strip.scrollLeft, right: 388 - strip.scrollLeft, width: 148 }) as DOMRect);
    fireEvent(window, new Event('resize'));
    expect(strip.scrollLeft).toBe(152);
    fireEvent(window, new Event('resize'));
    expect(strip.scrollLeft).toBe(152);
  });

  it('scrolls by mouse drag without navigating on the release click', () => {
    renderAt('/endpoints');
    const strip = overflowingStrip();
    sendPointer(strip, 'pointerdown', 180);
    sendPointer(strip, 'pointermove', 60);
    expect(strip.scrollLeft).toBe(120);
    expect(strip).toHaveAttribute('data-dragging', 'true');
    sendPointer(strip, 'pointerup', 60);
    fireEvent.click(screen.getByTestId('bottom-bar-page-trunks'), { detail: 1 });
    expect(screen.getByTestId('bottom-bar-page-endpoints')).toHaveAttribute('aria-current', 'page');
    expect(strip).not.toHaveAttribute('data-dragging');
    // A later ordinary click must still navigate.
    sendPointer(strip, 'pointerdown', 80);
    sendPointer(strip, 'pointerup', 80);
    fireEvent.click(screen.getByTestId('bottom-bar-page-trunks'), { detail: 1 });
    expect(screen.getByTestId('bottom-bar-page-trunks')).toHaveAttribute('aria-current', 'page');
  });

  it('preserves keyboard activation after a cancelled drag', () => {
    renderAt('/endpoints');
    const strip = overflowingStrip();
    sendPointer(strip, 'pointerdown', 180);
    sendPointer(strip, 'pointermove', 60);
    sendPointer(strip, 'pointercancel', 60);
    fireEvent.click(screen.getByTestId('bottom-bar-page-trunks'), { detail: 0 });
    expect(screen.getByTestId('bottom-bar-page-trunks')).toHaveAttribute('aria-current', 'page');
    expect(strip).not.toHaveAttribute('data-dragging');
  });

  it('leaves touch scrolling to the browser', () => {
    renderAt('/endpoints');
    const strip = overflowingStrip();
    sendPointer(strip, 'pointerdown', 180, 'touch');
    sendPointer(strip, 'pointermove', 60, 'touch');
    expect(strip.scrollLeft).toBe(0);
    expect(strip).not.toHaveAttribute('data-dragging');
  });

  it('shows Hub title without unrelated page shortcuts on the Hub route', () => {
    renderAt('/modules');
    expect(screen.getByTestId('bottom-bar-section')).toHaveTextContent('hub.title');
    expect(screen.queryByTestId('bottom-bar-pages')).toBeNull();
  });

  it.each(['single', 'permission-filtered'])('does not repeat the sole accessible page (%s)', (kind) => {
    userLevel = kind === 'permission-filtered' ? UserLevel.OPERATOR : UserLevel.ADMIN;
    const pages = kind === 'single' ? [coreRow.pages[0]] : [coreRow.pages[0], {...coreRow.pages[1], minLevels: [UserLevel.ADMIN]}];
    vi.mocked(useHubModules).mockReturnValue({ active: [{...coreRow, pages}], marketplace: [], isLoading: false, suppressedCodes: [], favoriteCodes: [], toggleFavorite: vi.fn(), isFavorite: () => false });
    renderAt('/endpoints');
    expect(screen.getByTestId('bottom-bar-section')).toHaveTextContent('nav.pbx');
    expect(screen.queryByTestId('bottom-bar-section-trigger')).toBeNull();
    expect(screen.queryByTestId('bottom-bar-pages')).toBeNull();
    expect(within(screen.getByTestId('mobile-bottom-bar')).queryByRole('link')).toBeNull();
  });

  it('does not expose pages of a disabled module', () => {
    vi.mocked(useHubModules).mockReturnValue({
      active: [{ ...coreRow, licenseStatus: 'disabled' }], marketplace: [], isLoading: false,
      suppressedCodes: [], favoriteCodes: [], toggleFavorite: vi.fn(), isFavorite: () => false,
    });
    renderAt('/endpoints');
    expect(screen.queryByTestId('bottom-bar-page-endpoints')).toBeNull();
  });
});

describe('all-pages access and route links',()=>{
 beforeEach(()=>{useIsMobileMock.mockReturnValue(true);userLevel=UserLevel.ADMIN;Element.prototype.scrollIntoView=vi.fn();vi.mocked(useHubModules).mockReturnValue({active:[coreRow],marketplace:[],isLoading:false,suppressedCodes:[],favoriteCodes:[],toggleFavorite:vi.fn(),isFavorite:()=>false});});
 it('opens a full page list and selects a route without a scrolling gesture',()=>{
  renderAt('/endpoints');fireEvent.click(screen.getByTestId('bottom-bar-section-trigger'));
  const menu=screen.getByTestId('bottom-bar-page-menu');expect(menu).toHaveAttribute('data-side','bottom');
  const link=within(menu).getByRole('link',{name:'nav.trunks'});expect(link).toHaveAttribute('href','/trunks');
  fireEvent.click(link);expect(screen.queryByTestId('bottom-bar-page-menu')).toBeNull();expect(screen.getByTestId('bottom-bar-page-trunks')).toHaveAttribute('aria-current','page');
 });
 it('does not open an empty page menu on the Hub',()=>{
  renderAt('/modules');expect(screen.queryByTestId('bottom-bar-section-trigger')).toBeNull();
 });
 it('does not start mouse dragging for a modified click',()=>{
  renderAt('/endpoints');const strip=overflowingStrip();
  const event=new MouseEvent('pointerdown',{bubbles:true,clientX:180,button:0,ctrlKey:true});
  Object.defineProperties(event,{pointerId:{value:1},pointerType:{value:'mouse'}});fireEvent(strip,event);sendPointer(strip,'pointermove',60);
  expect(strip.scrollLeft).toBe(0);expect(strip).not.toHaveAttribute('data-dragging');
  expect(screen.getByTestId('bottom-bar-page-trunks')).toHaveAttribute('href','/trunks');
 });
 it('cancels drag state after pointercancel and preserves the next click',()=>{
  renderAt('/endpoints');const strip=overflowingStrip();sendPointer(strip,'pointerdown',180);sendPointer(strip,'pointermove',60);sendPointer(strip,'pointercancel',60);
  fireEvent.click(screen.getByTestId('bottom-bar-page-trunks'),{detail:1});expect(screen.getByTestId('bottom-bar-page-trunks')).toHaveAttribute('aria-current','page');
 });
});
