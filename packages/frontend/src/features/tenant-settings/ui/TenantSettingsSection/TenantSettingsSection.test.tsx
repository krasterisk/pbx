import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { SwitchProps } from '@/shared/ui/Switch';

const capturedSwitches: SwitchProps[] = [];

const queryState = {
  isLoading: false,
  data: undefined as
    | { 'routes.show_raw_dialplan': boolean; 'routes.show_flowchart': boolean }
    | undefined,
};

const updateTenantSettings = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

vi.mock('@/entities/tenantSettings', () => ({
  useGetTenantSettingsQuery: () => queryState,
  useUpdateTenantSettingsMutation: () => [updateTenantSettings, { isError: false }],
}));

vi.mock('@/shared/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/ui')>();
  return {
    ...actual,
    Switch: (props: SwitchProps) => {
      capturedSwitches.push(props);
      return (
        <button
          type="button"
          role="switch"
          data-testid={props.id}
          data-checked={props.checked === undefined ? 'unset' : String(props.checked)}
          disabled={props.disabled}
          aria-checked={props.checked === undefined ? undefined : props.checked}
          onClick={() => props.onCheckedChange?.(!props.checked)}
        />
      );
    },
  };
});

import { TenantSettingsSection } from './TenantSettingsSection';

describe('TenantSettingsSection (Surface K / D-17 / D-18)', () => {
  beforeEach(() => {
    capturedSwitches.length = 0;
    queryState.isLoading = false;
    queryState.data = {
      'routes.show_raw_dialplan': true,
      'routes.show_flowchart': true,
    };
    updateTenantSettings.mockReset();
    updateTenantSettings.mockReturnValue({ unwrap: () => Promise.resolve(queryState.data) });
  });

  it('loading: both Switch disabled, checked omitted (not false default), loading tooltip', () => {
    queryState.isLoading = true;
    queryState.data = undefined;
    render(<TenantSettingsSection />);

    expect(capturedSwitches).toHaveLength(2);
    for (const props of capturedSwitches) {
      expect(props.disabled).toBe(true);
      expect(props.checked).toBeUndefined();
    }
    expect(screen.getByText('Загружаем настройки')).toBeInTheDocument();
    expect(screen.getByText('Показывать dialplan в маршруте')).toBeInTheDocument();
    expect(screen.getByText('Показывать блок-схему маршрута')).toBeInTheDocument();
  });

  it('after load: switches enabled and checked match server booleans', () => {
    queryState.data = {
      'routes.show_raw_dialplan': true,
      'routes.show_flowchart': false,
    };
    render(<TenantSettingsSection />);

    expect(capturedSwitches).toHaveLength(2);
    expect(capturedSwitches[0].disabled).toBeFalsy();
    expect(capturedSwitches[1].disabled).toBeFalsy();
    expect(capturedSwitches[0].checked).toBe(true);
    expect(capturedSwitches[1].checked).toBe(false);
  });

  it('rejected mutation shows error copy and leaves Switch on the previous value', async () => {
    updateTenantSettings.mockReturnValue({
      unwrap: () => Promise.reject(new Error('network')),
    });
    render(<TenantSettingsSection />);

    fireEvent.click(screen.getByTestId('tenant-setting-show-raw-dialplan'));

    await waitFor(() => {
      expect(screen.getByText('Не удалось сохранить настройку, значение возвращено')).toBeInTheDocument();
    });
    expect(capturedSwitches[0].checked).toBe(true);
  });

  it('flowchart switch has a later-availability hint and no flowchart component', () => {
    render(<TenantSettingsSection />);
    expect(screen.getByText('Появится позже')).toBeInTheDocument();
    expect(screen.queryByTestId('route-flowchart')).toBeNull();
  });
});
