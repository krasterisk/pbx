import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AiConnectionsPage } from './AiConnectionsPage';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/features/speechAnalytics/api/speechAnalyticsApi', () => ({
  cabinetSaProjects: () => [],
  useGetSaProjectsQuery: () => ({ data: [], isLoading: false }),
  useGetSaApiTokensQuery: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useCreateSaApiTokenMutation: () => [vi.fn(), { isLoading: false }],
}));

vi.mock('@/shared/api/endpoints/integrationsApi', () => ({
  useGetIntegrationsQuery: () => ({ data: { items: [] }, isLoading: false, isError: false, refetch: vi.fn() }),
  useCreateIntegrationMutation: () => [vi.fn(), { isLoading: false }],
  useRotateIntegrationMutation: () => [vi.fn(), { isLoading: false }],
  useRevokeIntegrationMutation: () => [vi.fn(), { isLoading: false }],
  useDeleteIntegrationMutation: () => [vi.fn(), { isLoading: false }],
}));

describe('AiConnectionsPage', () => {
  it('explains the missing project resource in the empty state', () => {
    render(<AiConnectionsPage product="speech_analytics" />);
    expect(screen.getByTestId('ai-connections-speech_analytics')).toBeInTheDocument();
    expect(screen.getByTestId('connections-empty')).toBeInTheDocument();
    expect(screen.getByText('aiProducts.connections.emptyHeading')).toBeInTheDocument();
    expect(screen.getByTestId('sa-api-docs')).toBeInTheDocument();
    expect(screen.queryByDisplayValue(/sk_/)).not.toBeInTheDocument();
  });
});
