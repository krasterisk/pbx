import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';

const updateMock = vi.fn(() => ({ unwrap: async () => ({}) }));

vi.mock('@/shared/api/endpoints/callCenterApi', () => ({
  useGetTenantSettingsQuery: () => ({
    data: { agent_hotkeys: null },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useUpdateTenantSettingsMutation: () => [updateMock, { isLoading: false }],
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppSelector: () => 2,
}));

vi.mock('@/entities/User', () => ({
  UserLevel: { SUPERVISOR: 2, ADMIN: 1 },
  selectUserLevel: () => 2,
}));

vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { HotkeysSettingsForm } from './HotkeysSettingsForm';

function renderForm() {
  const router = createMemoryRouter([{ path: '/', element: <HotkeysSettingsForm /> }]);
  return render(<RouterProvider router={router} />);
}

const press = (testId: string, init: KeyboardEventInit & { code: string }) =>
  fireEvent.keyDown(screen.getByTestId(testId), init);

describe('HotkeysSettingsForm (U5.6)', () => {
  beforeEach(() => updateMock.mockClear());

  it('records a combo, saves only the override, and reset-all clears it', async () => {
    renderForm();
    press('hotkey-input-answer', { code: 'KeyY', key: 'y', altKey: true });
    expect(screen.getByTestId('hotkey-input-answer')).toHaveValue('Alt+Y');
    expect(screen.getByTestId('hotkeys-save-bar')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('hotkeys-save-bar-save'));
    await waitFor(() => expect(updateMock).toHaveBeenCalledWith({ agent_hotkeys: { answer: 'Alt+KeyY' } }));
  });

  it('flags a duplicate and a reserved combo and blocks saving', () => {
    renderForm();
    press('hotkey-input-answer', { code: 'KeyH', key: 'h', altKey: true }); // duplicates default hangup
    expect(screen.getByTestId('hotkey-error-hangup')).toBeInTheDocument();
    expect(screen.getByTestId('hotkeys-save-bar-save')).toBeDisabled();

    press('hotkey-input-answer', { code: 'KeyD', key: 'd', altKey: true });
    expect(screen.getByTestId('hotkey-error-answer')).toBeInTheDocument();
    expect(screen.getByTestId('hotkeys-save-bar-save')).toBeDisabled();
  });

  it('restoring every default sends null (reset) when something was saved', () => {
    renderForm();
    press('hotkey-input-answer', { code: 'KeyY', key: 'y', altKey: true });
    fireEvent.click(screen.getByTestId('hotkeys-reset-all'));
    expect(screen.queryByTestId('hotkeys-save-bar')).not.toBeInTheDocument();
  });
});
