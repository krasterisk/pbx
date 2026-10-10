import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { Phone } from 'lucide-react';
import { UserLevel } from '@krasterisk/shared';
import type { HubModuleRow } from '@/features/modules/types';
import { ModuleNavigation } from './ModuleNavigation';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const single: HubModuleRow = { code: 'single', kind: 'base', navVariant: 'sidebar', labelKey: 'nav.only', licenseStatus: 'active', favorite: false, pages: [{ id: 'only', path: '/only', labelKey: 'page.only', icon: Phone }] };
const other = { id: 'other', path: '/other', labelKey: 'page.other', icon: Phone };
function Location() { return <output data-testid='location'>{useLocation().pathname}</output>; }
describe('ModuleNavigation single-page sections', () => {
  it.each([false, true])('uses one direct current link without disclosure or duplicate in compact=%s', (compact) => {
    const onExpand = vi.fn();
    render(<MemoryRouter initialEntries={['/only/details']}><ModuleNavigation rows={[single]} level={UserLevel.ADMIN} compact={compact} onExpand={onExpand} testIdPrefix='menu' includeHub={false} /><Location /></MemoryRouter>);
    const link = screen.getByRole('link', { name: 'nav.only' });
    expect(link).toHaveAttribute('href', '/only');expect(link).toHaveAttribute('aria-current', 'page');expect(link).not.toHaveAttribute('aria-expanded');
    expect(screen.queryByRole('button')).toBeNull();expect(screen.queryByTestId('menu-page-single-only')).toBeNull();
    expect(within(screen.getByRole('navigation')).getAllByRole('link')).toHaveLength(1);
    fireEvent.click(link);expect(screen.getByTestId('location')).toHaveTextContent('/only');expect(onExpand).not.toHaveBeenCalled();
  });
  it('counts only permitted pages when choosing between direct link and disclosure', () => {
    render(<MemoryRouter initialEntries={['/only']}><ModuleNavigation rows={[{...single, pages: [...single.pages, {...other, minLevels: [UserLevel.ADMIN]}]}]} level={UserLevel.OPERATOR} testIdPrefix='menu' includeHub={false} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'nav.only' })).toHaveAttribute('href', '/only');expect(screen.queryByRole('button')).toBeNull();expect(screen.queryByText('page.other')).toBeNull();
  });
  it('retains the Hub destination for an unavailable one-page section', () => {
    render(<MemoryRouter><ModuleNavigation rows={[{...single, licenseStatus: 'locked'}]} testIdPrefix='menu' includeHub={false} /></MemoryRouter>);
    expect(screen.getByTestId('menu-single')).toHaveAttribute('href', '/modules?module=single');expect(screen.queryByTestId('menu-page-single-only')).toBeNull();
  });
  it('keeps a real multi-page section expandable', () => {
    render(<MemoryRouter initialEntries={['/only']}><ModuleNavigation rows={[{...single, pages: [...single.pages, other]}]} testIdPrefix='menu' includeHub={false} /></MemoryRouter>);
    const section = screen.getByRole('button', { name: 'nav.only' });expect(section).toHaveAttribute('aria-expanded', 'true');expect(screen.getByRole('link', { name: 'page.other' })).toHaveAttribute('href', '/other');
    fireEvent.click(section);expect(section).toHaveAttribute('aria-expanded', 'false');expect(screen.queryByRole('link')).toBeNull();
  });
});
