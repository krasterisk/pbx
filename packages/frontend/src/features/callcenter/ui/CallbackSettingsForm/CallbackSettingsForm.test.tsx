import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DEFAULT_CALLBACK_POLICY, type ICallbackPolicy } from '@krasterisk/shared';

const queryState = {
  isLoading: false,
  isError: false,
  data: undefined as { callback_policy?: ICallbackPolicy | null } | undefined,
  refetch: vi.fn(),
};

const updateTenantSettings = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppSelector: (sel: (s: unknown) => unknown) =>
    sel({ auth: { user: { level: 4 } } }),
}));

vi.mock('@/entities/User', () => ({
  UserLevel: { SUPERVISOR: 3, ADMIN: 4, OPERATOR: 2 },
  selectUserLevel: (s: { auth: { user: { level: number } } }) => s.auth.user.level,
}));

vi.mock('@/shared/api/endpoints/callCenterApi', () => ({
  useGetTenantSettingsQuery: () => queryState,
  useUpdateTenantSettingsMutation: () => [updateTenantSettings, { isLoading: false }],
}));

import { CallbackSettingsForm, normalizeCallbackPolicy } from './CallbackSettingsForm';

describe('normalizeCallbackPolicy', () => {
  it('applies defaults for empty input', () => {
    expect(normalizeCallbackPolicy(null)).toEqual(DEFAULT_CALLBACK_POLICY);
    expect(normalizeCallbackPolicy(undefined).order_mode).toBe('both');
  });

  it('drops dtmf_digit when order_mode is queue_abandon', () => {
    const out = normalizeCallbackPolicy({
      order_mode: 'queue_abandon',
      dtmf_digit: '9',
      dial_order: 'caller_first',
    });
    expect(out.order_mode).toBe('queue_abandon');
    expect(out.dtmf_digit).toBeUndefined();
    expect(out.dial_order).toBe('caller_first');
  });
});

describe('CallbackSettingsForm (D-49 Surface L)', () => {
  beforeEach(() => {
    queryState.isLoading = false;
    queryState.isError = false;
    queryState.data = { callback_policy: { ...DEFAULT_CALLBACK_POLICY } };
    updateTenantSettings.mockReset();
    updateTenantSettings.mockReturnValue({ unwrap: () => Promise.resolve(queryState.data) });
  });

  it('has no write-on-change Switch; save is explicit PUT of callback_policy', async () => {
    render(<CallbackSettingsForm />);

    expect(screen.getByTestId('callback-settings-form')).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(updateTenantSettings).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('tab', { name: "At the caller's choice" }));
    expect(updateTenantSettings).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Save callback settings' }));
    await waitFor(() => {
      expect(updateTenantSettings).toHaveBeenCalledTimes(1);
    });
    expect(updateTenantSettings).toHaveBeenCalledWith({
      callback_policy: expect.objectContaining({
        order_mode: 'subscriber',
        dtmf_digit: '1',
        dial_order: 'agent_first',
      }),
    });
  });

  it('hides DTMF select when order_mode is queue_abandon', () => {
    queryState.data = {
      callback_policy: { order_mode: 'queue_abandon', dial_order: 'agent_first' },
    };
    render(<CallbackSettingsForm />);
    expect(screen.queryByLabelText('Key to request a callback')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Automatically when a caller abandons the queue' }))
      .toHaveAttribute('aria-selected', 'true');
  });
});
