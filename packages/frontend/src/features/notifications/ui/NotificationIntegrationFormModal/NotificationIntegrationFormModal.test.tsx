import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import {
  NotificationIntegrationFormModal,
  buildIntegrationSubmitPayload,
  buildWebhookAuthPayload,
  parseWebhookPayloadTemplate,
  formatPayloadTemplateForEdit,
} from './NotificationIntegrationFormModal';
import { notificationsPageReducer } from '../../model/slice/notificationsPageSlice';
import type { NotificationsPageSchema } from '../../model/types/notificationsSchema';
import * as notificationApiHooks from '@/shared/api/endpoints/notificationApi';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => {
      if (typeof fallback === 'string') return fallback;
      const labels: Record<string, string> = {
        'notifications.fields.bot_token': 'Bot Token',
        'notifications.fields.chat_id': 'Chat ID',
        'notifications.fields.to': 'Recipient Email',
        'notifications.hints.bot_token': 'Telegram bot token from BotFather',
        'notifications.hints.chat_id': 'Target chat ID for delivery',
        'notifications.hints.to': 'Default recipient email address',
        'notifications.channels.telegram': 'Telegram',
        'notifications.channels.email': 'Email',
        'notifications.namePlaceholder': 'Sales Telegram',
        'common.save': 'Save',
      };
      return labels[key] ?? key;
    },
  }),
}));

const createMock = vi.fn(() => ({ unwrap: () => Promise.resolve({ uid: 1 }) }));
const updateMock = vi.fn(() => ({ unwrap: () => Promise.resolve({ uid: 1 }) }));

vi.mock('@/shared/ui/Tooltip/Tooltip', () => ({
  InfoTooltip: ({ text }: { text: string }) => (
    <span role="note" data-testid="field-hint">
      {text}
    </span>
  ),
}));

vi.mock('@/shared/api/endpoints/notificationApi', () => ({
  useGetNotificationQuery: vi.fn(),
  useCreateNotificationMutation: vi.fn(),
  useUpdateNotificationMutation: vi.fn(),
}));

function renderModal(pageState?: Partial<NotificationsPageSchema>) {
  const notificationsPage: NotificationsPageSchema = {
    isModalOpen: true,
    modalMode: 'create',
    selectedIntegrationUid: null,
    ...pageState,
  };

  const store = configureStore({
    reducer: { notificationsPage: notificationsPageReducer },
    preloadedState: { notificationsPage },
  });

  return render(
    <Provider store={store}>
      <NotificationIntegrationFormModal />
    </Provider>,
  );
}

describe('buildIntegrationSubmitPayload', () => {
  it('separates config from credentials by secret flag', () => {
    expect(
      buildIntegrationSubmitPayload('telegram', {
        bot_token: 'tok123',
        chat_id: '-1001',
      }),
    ).toEqual({
      config: { chat_id: '-1001' },
      credentials: { bot_token: 'tok123' },
    });
  });

  it('parses webhook payload_template JSON into an object', () => {
    expect(
      buildIntegrationSubmitPayload('webhook', {
        url: 'https://hooks.example.com/x',
        payload_template: '{\n  "text": "{{message}}",\n  "caller": "{{clid}}"\n}',
      }),
    ).toEqual({
      config: {
        url: 'https://hooks.example.com/x',
        payload_template: { text: '{{message}}', caller: '{{clid}}' },
      },
      credentials: {},
    });
  });

  it('returns error for invalid payload_template JSON', () => {
    const result = buildIntegrationSubmitPayload('webhook', {
      url: 'https://hooks.example.com/x',
      payload_template: 'not-json',
    });
    expect(result.error).toBe('payload_template_invalid');
  });
});

describe('parseWebhookPayloadTemplate / formatPayloadTemplateForEdit', () => {
  it('accepts empty and object JSON', () => {
    expect(parseWebhookPayloadTemplate('')).toEqual({ ok: true });
    expect(parseWebhookPayloadTemplate('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
    expect(parseWebhookPayloadTemplate('[]').ok).toBe(false);
  });

  it('pretty-prints stored objects for the textarea', () => {
    expect(formatPayloadTemplateForEdit({ text: '{{message}}' })).toContain('"text"');
    expect(formatPayloadTemplateForEdit(null)).toBe('');
  });
});

describe('buildWebhookAuthPayload', () => {
  it('returns only auth_mode for none without prior auth', () => {
    expect(buildWebhookAuthPayload('none', '', [], { hadAuth: false })).toEqual({
      config: { auth_mode: 'none' },
    });
  });

  it('clears credentials for none when integration previously had auth', () => {
    expect(buildWebhookAuthPayload('none', '', [], { hadAuth: true })).toEqual({
      config: { auth_mode: 'none' },
      credentials: {},
    });
  });

  it('builds a Bearer Authorization header from token', () => {
    expect(buildWebhookAuthPayload('bearer', 'abc123', [], { hadAuth: false })).toEqual({
      config: { auth_mode: 'bearer' },
      credentials: { headers: { Authorization: 'Bearer abc123' } },
    });
  });

  it('omits credentials for bearer with blank token (keep existing)', () => {
    expect(buildWebhookAuthPayload('bearer', '   ', [], { hadAuth: true })).toEqual({
      config: { auth_mode: 'bearer' },
    });
  });

  it('builds custom headers and stores keys in config', () => {
    const result = buildWebhookAuthPayload(
      'custom',
      '',
      [
        { key: 'X-Api-Key', value: 'secret' },
        { key: 'X-Env', value: 'prod' },
      ],
      { hadAuth: false },
    );
    expect(result).toEqual({
      config: { auth_mode: 'custom', auth_header_keys: ['X-Api-Key', 'X-Env'] },
      credentials: { headers: { 'X-Api-Key': 'secret', 'X-Env': 'prod' } },
    });
  });

  it('keeps existing custom headers when all values are blank on edit', () => {
    const result = buildWebhookAuthPayload(
      'custom',
      '',
      [{ key: 'X-Api-Key', value: '' }],
      { hadAuth: true },
    );
    expect(result).toEqual({
      config: { auth_mode: 'custom', auth_header_keys: ['X-Api-Key'] },
    });
  });
});

describe('NotificationIntegrationFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (notificationApiHooks.useGetNotificationQuery as any).mockReturnValue({
      data: undefined,
      isFetching: false,
    });
    (notificationApiHooks.useCreateNotificationMutation as any).mockReturnValue([
      createMock,
      { isLoading: false },
    ]);
    (notificationApiHooks.useUpdateNotificationMutation as any).mockReturnValue([
      updateMock,
      { isLoading: false },
    ]);
  });

  it('switches rendered fields when channel changes', () => {
    renderModal();

    expect(screen.getByText('Bot Token')).toBeInTheDocument();
    expect(screen.getByText('Chat ID')).toBeInTheDocument();
    expect(screen.queryByText('Recipient Email')).not.toBeInTheDocument();

    const channelSelect = screen.getByRole('combobox');
    fireEvent.change(channelSelect, { target: { value: 'email' } });

    expect(screen.queryByText('Bot Token')).not.toBeInTheDocument();
    expect(screen.getByText('Recipient Email')).toBeInTheDocument();
  });

  it('shows a hint control per field and masks secret inputs', () => {
    renderModal();

    expect(screen.getAllByTestId('field-hint')).toHaveLength(2);
    expect(screen.getByText('Telegram bot token from BotFather')).toBeInTheDocument();
    expect(document.querySelector('input[type="password"]')).toBeInTheDocument();
    expect(document.querySelector('input[type="text"]')).toBeInTheDocument();
  });

  it('submits create payload with channel, config, and credentials', async () => {
    renderModal();

    fireEvent.change(screen.getByPlaceholderText('Sales Telegram'), {
      target: { value: 'Sales Bot' },
    });

    const inputs = screen.getAllByRole('textbox');
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.change(passwordInput, { target: { value: 'secret-token' } });
    fireEvent.change(inputs[inputs.length - 1], { target: { value: '-10099' } });

    fireEvent.click(screen.getByText('Save'));

    expect(createMock).toHaveBeenCalledWith({
      name: 'Sales Bot',
      channel: 'telegram',
      config: { chat_id: '-10099' },
      credentials: { bot_token: 'secret-token' },
    });
  });
});
