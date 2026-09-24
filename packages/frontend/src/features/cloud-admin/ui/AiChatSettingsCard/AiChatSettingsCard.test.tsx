import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { UserLevel } from '@krasterisk/shared';

const updateDefaultModel = vi.fn();
const updateSettings = vi.fn();

let usageRows = [
  {
    tenantUid: 10,
    tenantName: 'Acme PBX',
    tokensIn: 120,
    tokensOut: 50,
    turns: 2,
  },
  {
    tenantUid: 20,
    tenantName: null,
    tokensIn: 5,
    tokensOut: 1,
    turns: 1,
  },
];

let funnelRows = [
  { tenantUid: 10, pending: 1, applied: 2, rejected: 1, denied: 0 },
];

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrOpts?: string | Record<string, unknown>) =>
      typeof fallbackOrOpts === 'string' ? fallbackOrOpts : key,
  }),
}));

vi.mock('@/shared/api/endpoints/cloudAdminApi', () => ({
  useGetTenantsQuery: () => ({ data: undefined }),
  useGetSellersQuery: () => ({
    data: [{ id: 1, name: 'Platform Seller', isDefault: true }],
  }),
}));

vi.mock('@/shared/api/endpoints/aiChatApi', () => ({
  useGetAiChatSettingsQuery: () => ({ data: { confirmDestructive: false }, isLoading: false }),
  useUpdateAiChatSettingsMutation: () => [updateSettings, { isLoading: false }],
  useGetAgentUsageQuery: () => ({ data: usageRows, isLoading: false }),
  useGetAgentUsageFunnelQuery: () => ({ data: funnelRows, isLoading: false }),
  useGetAgentDefaultModelQuery: () => ({
    data: {
      providerUid: 1,
      providers: [{ uid: 1, name: 'OpenAI', model: 'gpt-4o' }],
    },
    isLoading: false,
  }),
  useUpdateAgentDefaultModelMutation: () => [
    (body: unknown) => {
      updateDefaultModel(body);
      return { unwrap: async () => body };
    },
    { isLoading: false },
  ],
}));

import { AgentUsageCard, AiChatSettingsCard } from './AiChatSettingsCard';

function renderCard(level: UserLevel, view: 'settings' | 'usage' = 'settings') {
  const store = configureStore({
    reducer: {
      auth: () => ({ isAuthenticated: true, user: { level } }),
    },
  });
  const node = view === 'usage' ? <AgentUsageCard /> : <AiChatSettingsCard />;
  return render(
    <Provider store={store}>
      {node}
    </Provider>,
  );
}

describe('AiChatSettingsCard (15-24 / D-07 / D-08)', () => {
  beforeEach(() => {
    updateDefaultModel.mockClear();
    updateSettings.mockClear();
  });

  it('renders neither the default model nor the usage view for a tenant session', () => {
    const { container } = renderCard(UserLevel.ADMIN);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('ai-chat-default-model')).toBeNull();
    expect(screen.queryByTestId('ai-chat-usage')).toBeNull();
  });

  it('lets a platform administrator pick and save the default model', async () => {
    renderCard(UserLevel.SUPERADMIN);
    const select = screen.getByTestId('ai-chat-default-model');
    expect(select).toBeTruthy();
    expect(screen.getByText('OpenAI')).toBeTruthy();
    fireEvent.change(select, { target: { value: '1' } });
    fireEvent.click(screen.getByTestId('ai-chat-default-model-save'));
    expect(updateDefaultModel).toHaveBeenCalledWith({ providerUid: 1 });
  });

  it('shows per-tenant tokens and the proposal funnel', () => {
    renderCard(UserLevel.SUPERADMIN, 'usage');
    const usage = screen.getByTestId('ai-chat-usage');
    expect(usage.textContent).toContain('Acme PBX');
    expect(usage.textContent).toContain('120');
    expect(usage.textContent).toContain('50');
    expect(usage.textContent).not.toContain('0.75');
    expect(usage.textContent).toContain('2');
    expect(usage.textContent).toMatch(/pending|applied|rejected/i);
    expect(screen.getByTestId('ai-chat-usage-row-10').textContent).toContain('10');
  });
});
