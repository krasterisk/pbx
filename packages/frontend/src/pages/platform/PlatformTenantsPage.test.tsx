import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

vi.mock('@/features/cloud-admin', () => ({
  TenantsTable: () => <div data-testid="tenants-table-stub">tenants</div>,
  TenantFormModal: () => null,
}));

vi.mock('@/features/cloud-admin/ui/SellersTable/SellersTable', () => ({
  SellersTable: () => <div data-testid="sellers-table">sellers</div>,
}));

vi.mock('@/features/cloud-admin/ui/AiChatSettingsCard/AiChatSettingsCard', () => ({
  AiChatSettingsCard: () => <div data-testid="ai-chat-settings">settings</div>,
  AgentUsageCard: () => <div data-testid="agent-usage">usage</div>,
}));

vi.mock('@/features/cloud-admin/ui/GlobalModelsPanel/GlobalModelsPanel', () => ({
  GlobalModelsPanel: () => <div data-testid="global-models-panel">models</div>,
}));

vi.mock('@/features/cloud-admin/ui/SpeechAnalyticsModelsCard/SpeechAnalyticsModelsCard', () => ({
  SpeechAnalyticsModelsCard: () => <div data-testid="speech-analytics-models">speech</div>,
}));

import { PlatformTenantsPage } from './PlatformTenantsPage';

describe('PlatformTenantsPage', () => {
  it('renders title, subtitle and tenants table', () => {
    render(<PlatformTenantsPage />);

    expect(screen.getByTestId('platform-tenants-page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'platform.tenantsTitle' })).toBeInTheDocument();
    expect(screen.getByText('platform.tenantsSubtitle')).toBeInTheDocument();
    expect(screen.getByTestId('tenants-table-stub')).toBeInTheDocument();
  });

  it('switches to suppliers tab and renders sellers table', () => {
    render(<PlatformTenantsPage />);
    fireEvent.click(screen.getByTestId('platform-sellers-tab'));
    expect(screen.getByTestId('sellers-table')).toBeInTheDocument();
    expect(screen.queryByTestId('agent-usage')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ai-chat-settings')).not.toBeInTheDocument();
  });

  it('puts agent usage and global settings on their own tabs', () => {
    render(<PlatformTenantsPage />);
    fireEvent.click(screen.getByTestId('platform-usage-tab'));
    expect(screen.getByTestId('agent-usage')).toBeInTheDocument();
    expect(screen.queryByTestId('sellers-table')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('platform-settings-tab'));
    expect(screen.getByTestId('ai-chat-settings')).toBeInTheDocument();
    expect(screen.getByTestId('speech-analytics-models')).toBeInTheDocument();
    expect(screen.queryByTestId('agent-usage')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('platform-models-tab'));
    expect(screen.getByTestId('global-models-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('speech-analytics-models')).not.toBeInTheDocument();
  });
});
