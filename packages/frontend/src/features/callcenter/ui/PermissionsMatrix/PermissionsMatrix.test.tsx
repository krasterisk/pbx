import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PermissionsMatrix } from './PermissionsMatrix';
import type { IPermissionsMatrixRow } from '@/shared/api/endpoints/callCenterApi';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

const rows: IPermissionsMatrixRow[] = [
  {
    operator_user_id: 42,
    name: 'Alice',
    level: 2,
    permissions: {
      can_spy: false,
      spyable: true,
      spy_modes: ['listen'],
      click_to_call: true,
      customize_ui: false,
    },
  },
  {
    operator_user_id: 7,
    name: 'Bob',
    level: 2,
    permissions: {
      can_spy: true,
      spyable: true,
      spy_modes: ['listen', 'whisper'],
      click_to_call: false,
      customize_ui: false,
    },
  },
];

describe('PermissionsMatrix', () => {
  it('renders operator rows and toggles a boolean right', () => {
    const onToggleBool = vi.fn();
    const onToggleSpyMode = vi.fn();
    const onOpenOperator = vi.fn();

    render(
      <PermissionsMatrix
        rows={rows}
        locksByLevel={{}}
        onToggleBool={onToggleBool}
        onToggleSpyMode={onToggleSpyMode}
        onOpenOperator={onOpenOperator}
      />,
    );

    expect(screen.getByTestId('permissions-matrix')).toBeTruthy();
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();

    fireEvent.click(screen.getByText('Alice'));
    expect(onOpenOperator).toHaveBeenCalledWith(rows[0]);

    const aliceClickToCall = screen.getByTestId('perm-42-click_to_call');
    fireEvent.click(aliceClickToCall);
    expect(onToggleBool).toHaveBeenCalledWith(42, 'click_to_call', false);
  });

  it('disables locked cells', () => {
    const onToggleBool = vi.fn();

    render(
      <PermissionsMatrix
        rows={rows}
        locksByLevel={{ '2': { click_to_call: true } }}
        onToggleBool={onToggleBool}
        onToggleSpyMode={vi.fn()}
        onOpenOperator={vi.fn()}
      />,
    );

    const aliceClickToCall = screen.getByTestId('perm-42-click_to_call');
    expect(aliceClickToCall).toBeDisabled();
  });
});
