import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { TopbarSearch } from './TopbarSearch';

const mobile = vi.hoisted(() => ({ value: false }));
vi.mock('@/shared/hooks/useIsMobile', () => ({ useIsMobile: () => mobile.value }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const items = [
  { id: '1', label: 'Абоненты', path: '/endpoints', section: 'PBX' },
  { id: '2', label: 'Панель супервизора', path: '/callcenter/supervisor', section: 'Call Center' },
  { id: '3', label: 'Панель оператора', path: '/callcenter/agent', section: 'Call Center' },
];
function Location() { return <output data-testid="location">{useLocation().pathname}</output>; }
function SearchHarness() {
  return <MemoryRouter initialEntries={['/modules']}><TopbarSearch items={items} /><button>Other control</button><Location /></MemoryRouter>;
}
const trigger = () => document.getElementById('shell-cmdk-trigger')!;

beforeEach(() => { mobile.value = false; Element.prototype.scrollIntoView = vi.fn(); });

describe('topbar responsive live search', () => {
  it('starts collapsed, expands on keyboard focus, filters live and navigates with arrows/Enter', async () => {
    const user = userEvent.setup();
    render(<SearchHarness />);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    await user.tab();
    const input = await screen.findByRole('combobox');
    await waitFor(() => expect(input).toHaveFocus());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.type(input, 'панель');
    expect(screen.getAllByRole('option')).toHaveLength(2);
    expect(screen.queryByRole('option', { name: /Абоненты/ })).not.toBeInTheDocument();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(screen.getByTestId('location')).toHaveTextContent('/callcenter/agent');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it('allows pointer selection without losing the option when the input would blur', async () => {
    const user = userEvent.setup();
    render(<SearchHarness />);
    await user.click(trigger());
    await user.type(await screen.findByRole('combobox'), 'супервизора');
    await user.click(screen.getByRole('option', { name: /Панель супервизора/ }));
    expect(screen.getByTestId('location')).toHaveTextContent('/callcenter/supervisor');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('announces no matches and collapses on Escape without reopening when focus returns', async () => {
    const user = userEvent.setup();
    render(<SearchHarness />);
    await user.click(trigger());
    await user.type(await screen.findByRole('combobox'), 'no-match-362');
    expect(screen.getByTestId('command-palette-empty')).toHaveAttribute('role', 'status');
    expect(screen.getByTestId('command-palette-empty')).toHaveTextContent('commandPalette.empty');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    await user.tab();
    expect(screen.getByRole('button', { name: 'Other control' })).toHaveFocus();
  });

  it('dismisses on outside pointer and Tab without stealing focus', async () => {
    const user = userEvent.setup();
    render(<SearchHarness />);
    await user.click(trigger());
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveFocus());
    await user.click(screen.getByRole('button', { name: 'Other control' }));
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Other control' })).toHaveFocus();
    await user.click(trigger());
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveFocus());
    await user.tab();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Other control' })).toHaveFocus();
  });

  it('keeps Ctrl/Meta+K, restores the prior control and ignores IME Enter', async () => {
    const user = userEvent.setup();
    render(<SearchHarness />);
    const other = screen.getByRole('button', { name: 'Other control' });
    other.focus();
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const input = await screen.findByRole('combobox');
    await waitFor(() => expect(input).toHaveFocus());
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(screen.getByTestId('location')).toHaveTextContent('/modules');
    await user.keyboard('{Escape}');
    expect(other).toHaveFocus();
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(await screen.findByRole('combobox')).toBeInTheDocument();
  });

  it('uses a modal search on phones, and closes/reset search when the breakpoint changes', async () => {
    mobile.value = true;
    const user = userEvent.setup();
    const view = render(<SearchHarness />);
    await user.tab();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(trigger());
    const dialog = await screen.findByRole('dialog');
    const input = within(dialog).getByRole('combobox');
    await waitFor(() => expect(input).toHaveFocus());
    await user.type(input, 'Абоненты');
    expect(within(dialog).getAllByRole('option')).toHaveLength(1);
    mobile.value = false;
    view.rerender(<SearchHarness />);
    await waitFor(() => expect(screen.queryByRole('combobox')).not.toBeInTheDocument());
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(await screen.findByRole('combobox')).toHaveValue('');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
