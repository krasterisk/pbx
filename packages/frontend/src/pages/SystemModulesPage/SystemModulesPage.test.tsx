import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { UserLevel } from '@krasterisk/shared';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppSelector: (sel: (s: { auth: { user: { level: UserLevel } } }) => unknown) =>
    sel({ auth: { user: { level: UserLevel.ADMIN } } }),
}));

vi.mock('@/features/modules/ui/TenantModulesPanel/TenantModulesPanel', () => ({
  TenantModulesPanel: () => <div data-testid="tenant-modules-stub">modules</div>,
}));

vi.mock('@/features/modules/ui/TenantRoleStartEditor/TenantRoleStartEditor', () => ({
  TenantRoleStartEditor: () => <div data-testid="role-start-stub">role-start</div>,
}));

import { SystemModulesPage } from './SystemModulesPage';

describe('SystemModulesPage hybrid overflow (D-29 / D-27 wave D)', () => {
  it('exposes hybrid overflow marker for modules content', () => {
    render(<SystemModulesPage />);
    expect(screen.getByTestId('system-modules-page-responsive')).toBeInTheDocument();
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'overflow-x-auto');
    expect(hybrid.className).toMatch(/overflow-x-auto/);
    expect(screen.getByTestId('tenant-modules-stub')).toBeInTheDocument();
  });
});
