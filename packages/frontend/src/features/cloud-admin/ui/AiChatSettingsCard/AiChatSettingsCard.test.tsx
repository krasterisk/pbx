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
    tokensIn: 120,
    tokensOut: 50,
    turns: 2,
    spendUsd: 0.75,
    spendAvailable: true,
  },
  {
    tenantUid: 20,
    tokensIn: 5,
    tokensOut: 1,
    turns: 1,
    spendUsd: null,
    spendAvailable: false,
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

import { AiChatSettingsCard } from './AiChatSettingsCard';

function renderCard(level: UserLevel) {
  const store = configureStore({
    reducer: {
      auth: () => ({ isAuthenticated: true, user: { level } }),
    },
  });
  return render(
    <Provider store={store}>
      <AiChatSettingsCard />
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
    expect(screen.getByText('gpt-4o')).toBeTruthy();
    fireEvent.change(select, { target: { value: '1' } });
    fireEvent.click(screen.getByTestId('ai-chat-default-model-save'));
    expect(updateDefaultModel).toHaveBeenCalledWith({ providerUid: 1 });
  });

  it('shows per-tenant tokens, spend and the proposal funnel', () => {
    renderCard(UserLevel.SUPERADMIN);
    const usage = screen.getByTestId('ai-chat-usage');
    expect(usage.textContent).toContain('120');
    expect(usage.textContent).toContain('50');
    expect(usage.textContent).toContain('0.75');
    expect(usage.textContent).toContain('2');
    expect(usage.textContent).toMatch(/pending|applied|rejected/i);
  });

  it('renders unavailable spend instead of a zero amount', () => {
    renderCard(UserLevel.SUPERADMIN);
    expect(screen.getByTestId('ai-chat-spend-unavailable')).toBeTruthy();
    const usage = screen.getByTestId('ai-chat-usage');
    expect(usage.textContent).not.toMatch(/\$0(?:\.0+)?\b/);
  });
});
