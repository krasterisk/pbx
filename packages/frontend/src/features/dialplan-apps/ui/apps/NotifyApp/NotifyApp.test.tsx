import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NotifyApp } from './NotifyApp';
import * as notificationApiHooks from '@/shared/api/endpoints/notificationApi';
import { NOTIFY_PRESETS } from '../../../config/notifyPresets';

const mockOnChange = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

vi.mock('@/shared/ui/Tooltip/Tooltip', () => ({
  InfoTooltip: ({ text }: { text: string }) => (
    <span role="note" data-testid="vars-hint">
      {text}
    </span>
  ),
}));

vi.mock('@/shared/api/endpoints/notificationApi', () => ({
  useGetNotificationsQuery: vi.fn(),
}));

const baseParams = { integration_uid: '', message: '', target: '' };

describe('NotifyApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (notificationApiHooks.useGetNotificationsQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [
        { uid: 3, name: 'Sales TG', channel: 'telegram', config: {}, user_uid: 1 },
        { uid: 5, name: 'Ops Email', channel: 'email', config: {}, user_uid: 1 },
        { uid: 7, name: 'CRM Hook', channel: 'webhook', config: {}, user_uid: 1 },
      ],
    });
  });

  it('renders integration options and calls onChange for integration_uid', () => {
    render(<NotifyApp params={baseParams} onChange={mockOnChange} />);

    const select = screen.getByLabelText('Select integration') as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['', '3', '5', '7']);

    fireEvent.change(select, { target: { value: '5' } });
    expect(mockOnChange).toHaveBeenCalledWith({ integration_uid: '5' });
  });

  it('applies a preset into the message template via onChange', () => {
    render(<NotifyApp params={baseParams} onChange={mockOnChange} />);

    fireEvent.change(screen.getByLabelText('Presets'), { target: { value: 'incomingCall' } });
    expect(mockOnChange).toHaveBeenCalledWith({ preset: 'incomingCall' });
    expect(mockOnChange).toHaveBeenCalledWith({ message: NOTIFY_PRESETS.incomingCall });
    expect(NOTIFY_PRESETS.incomingCall).toContain('${CALLERID(num)}');
  });

  it('updates message and optional target fields for non-webhook channels', () => {
    render(
      <NotifyApp
        params={{ integration_uid: '3', message: '', target: '' }}
        onChange={mockOnChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Шаблон сообщения'), {
      target: { value: 'Custom ${EXTEN}' },
    });
    expect(mockOnChange).toHaveBeenCalledWith({ message: 'Custom ${EXTEN}' });

    fireEvent.change(screen.getByLabelText('Переопределение получателя (опц.)'), {
      target: { value: '-1001' },
    });
    expect(mockOnChange).toHaveBeenCalledWith({ target: '-1001' });
  });

  it('hides target and shows webhook message label when webhook integration is selected', () => {
    render(
      <NotifyApp
        params={{ integration_uid: '7', message: '', target: 'x' }}
        onChange={mockOnChange}
      />,
    );

    expect(screen.getByLabelText('Текст уведомления')).toBeInTheDocument();
    expect(screen.queryByLabelText('Переопределение получателя (опц.)')).not.toBeInTheDocument();
  });

  it('clears target when switching to a webhook integration', () => {
    render(
      <NotifyApp
        params={{ integration_uid: '3', message: '', target: '-1001' }}
        onChange={mockOnChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Select integration'), { target: { value: '7' } });
    expect(mockOnChange).toHaveBeenCalledWith({ integration_uid: '7' });
    expect(mockOnChange).toHaveBeenCalledWith({ target: '' });
  });
});
