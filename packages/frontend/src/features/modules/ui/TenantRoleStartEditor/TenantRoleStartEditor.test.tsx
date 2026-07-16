import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TenantRoleStartEditor } from './TenantRoleStartEditor';
import * as api from '@/shared/api/endpoints/cloudAdminApi';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/shared/api/endpoints/cloudAdminApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/endpoints/cloudAdminApi')>();
  return {
    ...actual,
    useGetTenantRoleStartOverridesQuery: vi.fn(),
    useUpdateTenantRoleStartMutation: vi.fn(),
  };
});

describe('TenantRoleStartEditor (D-04)', () => {
  const save = vi.fn(() => ({ unwrap: () => Promise.resolve([]) }));

  beforeEach(() => {
    vi.clearAllMocks();
    (api.useGetTenantRoleStartOverridesQuery as any).mockReturnValue({
      data: [{ user_level: 2, start_path: '/queues' }],
      isLoading: false,
    });
    (api.useUpdateTenantRoleStartMutation as any).mockReturnValue([save, { isLoading: false }]);
  });

  it('renders and saves tenant_role_start rows via API', async () => {
    render(<TenantRoleStartEditor />);
    expect(screen.getByTestId('tenant-role-start-editor')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'system.roleStartSave' }));
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: expect.arrayContaining([
          expect.objectContaining({ user_level: expect.any(Number), start_path: expect.any(String) }),
        ]),
      }),
    );
  });
});
