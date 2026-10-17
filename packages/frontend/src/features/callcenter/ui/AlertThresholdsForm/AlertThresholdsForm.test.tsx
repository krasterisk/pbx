import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';

const queryState = {
  isLoading: false,
  isError: false,
  data: undefined as Record<string, unknown> | undefined,
  refetch: vi.fn(),
};

const updateTenantSettings = vi.fn();
const userState = { level: 4 };

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppSelector: (sel: (s: unknown) => unknown) => sel({ auth: { user: { level: userState.level } } }),
}));

vi.mock('@/entities/User', () => ({
  UserLevel: { SUPERVISOR: 3, ADMIN: 4, OPERATOR: 2 },
  selectUserLevel: (s: { auth: { user: { level: number } } }) => s.auth.user.level,
}));

vi.mock('@/shared/api/endpoints/callCenterApi', () => ({
  useGetTenantSettingsQuery: () => queryState,
  useUpdateTenantSettingsMutation: () => [updateTenantSettings, { isLoading: false }],
}));

import { AlertThresholdsForm, ALERT_FIELDS, SLA_FIELDS } from './AlertThresholdsForm';

const render = (ui: React.ReactElement) =>
  rtlRender(<RouterProvider router={createMemoryRouter([{ path: '/', element: ui }])} />);

describe('AlertThresholdsForm short abandon (R2)', () => {
  beforeEach(() => {
    userState.level = 4;
    queryState.isLoading = false;
    queryState.isError = false;
    queryState.data = {
      default_sla_threshold: 20,
      short_abandon_sec: 8,
      alert_sound_enabled: true,
      alert_thresholds: { max_wait_sec: 60, abandon_rate_pct: 10, sla_critical_pct: 70, agents_available_min: 1 },
    };
    updateTenantSettings.mockReset();
    updateTenantSettings.mockReturnValue({ unwrap: () => Promise.resolve(queryState.data) });
  });

  it('shows the stored short-abandon window', () => {
    render(<AlertThresholdsForm />);
    expect(screen.getByLabelText('callcenter.settings.alerts.shortAbandon')).toHaveValue(8);
  });

  it('defaults to 5 seconds for a tenant that never saved the setting', () => {
    queryState.data = { ...queryState.data, short_abandon_sec: undefined };
    render(<AlertThresholdsForm />);
    expect(screen.getByLabelText('callcenter.settings.alerts.shortAbandon')).toHaveValue(5);
  });

  it('saves the edited value through the explicit Save button only', async () => {
    render(<AlertThresholdsForm />);

    fireEvent.change(screen.getByLabelText('callcenter.settings.alerts.shortAbandon'), { target: { value: '3' } });
    expect(updateTenantSettings).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('alerts-save-bar-save'));
    await waitFor(() => expect(updateTenantSettings).toHaveBeenCalledTimes(1));
    expect(updateTenantSettings).toHaveBeenCalledWith(
      expect.objectContaining({ short_abandon_sec: 3, default_sla_threshold: 20 }),
    );
  });

  it('allows 0 to switch the exclusion off', async () => {
    render(<AlertThresholdsForm />);
    fireEvent.change(screen.getByLabelText('callcenter.settings.alerts.shortAbandon'), { target: { value: '0' } });
    fireEvent.click(screen.getByTestId('alerts-save-bar-save'));
    await waitFor(() => expect(updateTenantSettings).toHaveBeenCalled());
    expect(updateTenantSettings.mock.calls[0][0].short_abandon_sec).toBe(0);
  });

  it('is read-only for an operator and offers no Save', () => {
    userState.level = 2;
    render(<AlertThresholdsForm />);
    expect(screen.getByLabelText('callcenter.settings.alerts.shortAbandon')).toBeDisabled();
    expect(screen.queryByTestId('alerts-save-bar-save')).not.toBeInTheDocument();
  });


  it('explains every threshold field and shows the save bar only after an edit', () => {
    render(<AlertThresholdsForm />);
    for (const f of [...SLA_FIELDS, ...ALERT_FIELDS]) {
      expect(screen.getByTestId(`${f.id}-hint`)).toHaveTextContent(f.hintKey);
      expect(document.getElementById(f.id)).toHaveAttribute('aria-describedby', `${f.id}-hint`);
    }
    expect(screen.queryByTestId('alerts-save-bar')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('callcenter.settings.alerts.maxWait'), { target: { value: '90' } });
    expect(screen.getByTestId('alerts-save-bar')).toBeInTheDocument();
  });
});
