import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { Phone } from 'lucide-react';
import { UserLevel } from '@krasterisk/shared';
import type { HubModuleRow } from '@/features/modules/types';
import { ModuleNavigation } from './ModuleNavigation';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const module: HubModuleRow = {
  code: 'calls', kind: 'base', navVariant: 'sidebar', labelKey: 'nav.calls',
  licenseStatus: 'active', favorite: false,
  pages: [
    { id: 'first', path: '/first', labelKey: 'page.first', icon: Phone },
    { id: 'second', path: '/second', labelKey: 'page.second', icon: Phone },
  ],
};
function Location() { return <output data-testid="location">{useLocation().pathname}</output>; }
function fixture(rows = [module], compact = true) {
  return <MemoryRouter initialEntries={['/first']}>
    <ModuleNavigation rows={rows} compact={compact} level={UserLevel.OPERATOR} testIdPrefix="menu" includeHub={false} />
    <button type="button">Outside</button><Location />
  </MemoryRouter>;
}
function pointer(element: Element, type: 'pointerover' | 'pointerout', pointerType = 'mouse') {
  const event = new Event(type, { bubbles: true });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  fireEvent(element, event);
}
async function advance(ms: number) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
afterEach(() => { vi.useRealTimers(); });

describe('compact navigation flyout', () => {
  it('opens an anchored panel with native links and the current page, then closes after navigation', async () => {
    const user = userEvent.setup();
    render(fixture());
    const trigger = screen.getByRole('button', { name: 'nav.calls' });
    expect(trigger).not.toHaveAttribute('title');
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(trigger);
    const panel = screen.getByRole('dialog', { name: 'nav.calls' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(panel).toHaveClass('layer-popover');
    expect(screen.getByTestId('menu-navigation')).not.toContainElement(panel);
    expect(within(panel).getByRole('link', { name: 'page.first' })).toHaveAttribute('aria-current', 'page');
    expect(within(panel).getByRole('link', { name: 'page.second' })).toHaveAttribute('href', '/second');
    await user.click(within(panel).getByRole('link', { name: 'page.second' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/second');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it.each(['{Enter}', ' '])('opens with %s, supports Tab and returns focus on Escape', async key => {
    const user = userEvent.setup();
    render(fixture());
    const trigger = screen.getByRole('button', { name: 'nav.calls' });
    await user.tab();
    expect(trigger).toHaveFocus();
    await user.keyboard(key);
    const first = screen.getByRole('link', { name: 'page.first' });
    expect(first).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('link', { name: 'page.second' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('closes on outside interaction without returning focus away from the clicked control', async () => {
    const user = userEvent.setup();
    render(fixture());
    await user.click(screen.getByRole('button', { name: 'nav.calls' }));
    const outside = screen.getByRole('button', { name: 'Outside' });
    await user.click(outside);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(outside).toHaveFocus();
  });

  it('delays hover opening, preserves focus, survives pointer travel and closes after leaving', async () => {
    vi.useFakeTimers();
    render(fixture());
    const outside = screen.getByRole('button', { name: 'Outside' });
    outside.focus();
    const trigger = screen.getByRole('button', { name: 'nav.calls' });
    pointer(trigger, 'pointerover');
    await advance(179);
    expect(screen.queryByRole('dialog')).toBeNull();
    await advance(1);
    const panel = screen.getByRole('dialog');
    expect(outside).toHaveFocus();
    pointer(trigger, 'pointerout');
    await advance(100);
    pointer(panel, 'pointerover');
    await advance(300);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    pointer(panel, 'pointerout');
    await advance(250);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(outside).toHaveFocus();
  });

  it('keeps a hover preview open when clicked and closes it on the next click', async () => {
    vi.useFakeTimers();
    render(fixture());
    const trigger = screen.getByRole('button', { name: 'nav.calls' });
    pointer(trigger, 'pointerover');
    await advance(180);
    fireEvent.click(trigger, { detail: 1 });
    expect(screen.getByRole('link', { name: 'page.first' })).toHaveFocus();
    pointer(trigger, 'pointerout');
    await advance(300);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(trigger, { detail: 1 });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps only one panel open and ignores another section’s pending close', async () => {
    vi.useFakeTimers();
    const other: HubModuleRow = { ...module, code: 'other', labelKey: 'nav.other', pages: module.pages.map(page => ({ ...page, path: `/other${page.path}` })) };
    render(fixture([module, other]));
    const first = screen.getByRole('button', { name: 'nav.calls' });
    pointer(first, 'pointerover');
    await advance(180);
    pointer(first, 'pointerout');
    pointer(screen.getByRole('button', { name: 'nav.other' }), 'pointerover');
    await advance(180);
    await advance(70);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog', { name: 'nav.other' })).toBeInTheDocument();
  });

  it('cancels a brief hover and ignores touch hover', async () => {
    vi.useFakeTimers();
    render(fixture());
    const trigger = screen.getByRole('button', { name: 'nav.calls' });
    pointer(trigger, 'pointerover');
    await advance(100);
    pointer(trigger, 'pointerout');
    await advance(300);
    expect(screen.queryByRole('dialog')).toBeNull();
    pointer(trigger, 'pointerover', 'touch');
    await advance(300);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes when the sidebar scrolls or switches to expanded mode', async () => {
    const user = userEvent.setup();
    const view = render(fixture());
    await user.click(screen.getByRole('button', { name: 'nav.calls' }));
    fireEvent.scroll(screen.getByTestId('menu-navigation'));
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'nav.calls' }));
    view.rerender(fixture([module], false));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('link', { name: 'page.second' })).toBeInTheDocument();
  });

  it('filters pages and sections before creating the panel, and hides locked modules', async () => {
    const user = userEvent.setup();
    const restricted = { id: 'admin', path: '/admin', labelKey: 'page.admin', icon: Phone, minLevels: [UserLevel.ADMIN] };
    render(fixture([
      { ...module, pages: [...module.pages, restricted] },
      { ...module, code: 'hidden', tenantVisible: false },
      { ...module, code: 'locked', labelKey: 'nav.locked', licenseStatus: 'locked' },
    ]));
    expect(screen.queryByTestId('menu-hidden')).toBeNull();
    expect(screen.queryByTestId('menu-locked')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'nav.calls' }));
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(within(screen.getByRole('dialog')).getAllByRole('link')).toHaveLength(2);
    expect(screen.queryByRole('link', { name: 'page.admin' })).toBeNull();
  });
});
