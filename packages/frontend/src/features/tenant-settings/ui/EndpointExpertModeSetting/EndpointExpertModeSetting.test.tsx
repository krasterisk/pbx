import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { EndpointExpertModeSetting } from './EndpointExpertModeSetting';

const { update, query } = vi.hoisted(() => ({
  update: vi.fn(),
  query: { data: { 'endpoints.expert_mode': false }, isLoading: false, isError: false, refetch: vi.fn() },
}));
vi.mock('@/entities/tenantSettings', () => ({
  useGetTenantSettingsQuery: () => query,
  useUpdateTenantSettingsMutation: () => [update],
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe('EndpointExpertModeSetting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    query.isError = false;
    update.mockReturnValue({ unwrap: () => Promise.resolve({}) });
  });

  it('writes the tenant preference from the global switch', async () => {
    render(<EndpointExpertModeSetting />);
    await userEvent.click(screen.getByRole('switch', { name: 'endpoints.expertModeGlobal' }));
    expect(update).toHaveBeenCalledWith({ 'endpoints.expert_mode': true });
  });

  it('reports a rejected save', async () => {
    update.mockReturnValue({ unwrap: () => Promise.reject(new Error('Rejected')) });
    render(<EndpointExpertModeSetting />);
    await userEvent.click(screen.getByRole('switch', { name: 'endpoints.expertModeGlobal' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('settings.tenant.saveError'));
  });

  it('offers retry on failed settings load', async () => {
    query.isError = true;
    render(<EndpointExpertModeSetting />);
    await userEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    expect(query.refetch).toHaveBeenCalledOnce();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });
});
