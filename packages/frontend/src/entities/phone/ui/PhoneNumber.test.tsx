import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { PhoneNumber } from './PhoneNumber';
import { PhoneActionsProvider } from '../model/PhoneActionsContext';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
describe('phone actions', () => {
  it('opens number actions without activating a containing call row', async () => {
    const row = vi.fn();
    render(<MemoryRouter><div onClick={row}><PhoneNumber number="101" name="Мария"/></div></MemoryRouter>);
    await userEvent.click(screen.getByRole('button', { name: 'phoneNumber.actionsFor' }));
    expect(screen.getByRole('menuitem', { name: 'phoneNumber.disconnected' })).toHaveAttribute('data-disabled');
    expect(screen.getByRole('menuitem', { name: 'phoneNumber.history' })).toHaveAttribute('href', '/reports/calls?search=101&dateFrom=&dateTo=');
    expect(row).not.toHaveBeenCalled();
  });
  it('calls only through the supplied active session and preserves its selected owner', async () => {
    const call = vi.fn();
    render(<MemoryRouter><PhoneActionsProvider value={{canCall:true,call}}><PhoneNumber number="+7 (913) 555-11-22"/></PhoneActionsProvider></MemoryRouter>);
    await userEvent.click(screen.getByRole('button', { name: 'phoneNumber.actionsFor' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'phoneNumber.call' }));
    await waitFor(() => expect(call).toHaveBeenCalledWith('+79135551122'));
    expect(call).toHaveBeenCalledTimes(1);
  });
  it('offers setup instead of attempting a call with an inactive phone', async () => {
    const call = vi.fn(), configure = vi.fn();
    render(<MemoryRouter><PhoneActionsProvider value={{canCall:false,call,configure}}><PhoneNumber number="101"/></PhoneActionsProvider></MemoryRouter>);
    await userEvent.click(screen.getByRole('button', { name: 'phoneNumber.actionsFor' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'phoneNumber.connect' }));
    expect(configure).toHaveBeenCalledTimes(1);expect(call).not.toHaveBeenCalled();
  });
  it('renders technical channel values as noninteractive fallback text', () => {
    render(<PhoneNumber number="PJSIP/e101_0" fallback="Неизвестный участник"/>);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Неизвестный участник')).toBeInTheDocument();
  });
});
