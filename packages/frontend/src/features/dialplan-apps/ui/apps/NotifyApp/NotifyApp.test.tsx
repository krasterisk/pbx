import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NotifyApp } from './NotifyApp';
import * as notificationApiHooks from '@/shared/api/endpoints/notificationApi';
import { NOTIFY_PRESETS } from '../../../config/notifyPresets';
import type { IRouteAction } from '@krasterisk/shared';

const mockOnUpdate = vi.fn();

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

const baseAction: IRouteAction = {
  id: 'action-notify',
  type: 'notify',
  params: { integration_uid: '', message: '', target: '' },
  condition: {},
};

describe('NotifyApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (notificationApiHooks.useGetNotificationsQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [
        { uid: 3, name: 'Sales TG', channel: 'telegram', config: {}, user_uid: 1 },
        { uid: 5, name: 'Ops Email', channel: 'email', config: {}, user_uid: 1 },
      ],
    });
  });

  it('renders integration options and calls onUpdate for integration_uid', () => {
    render(<NotifyApp action={baseAction} onUpdate={mockOnUpdate} />);

    const select = screen.getByLabelText('Select integration') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual(['', '3', '5']);

    fireEvent.change(select, { target: { value: '5' } });
    expect(mockOnUpdate).toHaveBeenCalledWith('action-notify', 'params.integration_uid', '5');
  });

  it('applies a preset into the message template via onUpdate', () => {
    render(<NotifyApp action={baseAction} onUpdate={mockOnUpdate} />);

    const presets = screen.getByLabelText('Presets') as HTMLSelectElement;
    fireEvent.change(presets, { target: { value: 'incomingCall' } });

    expect(mockOnUpdate).toHaveBeenCalledWith(
      'action-notify',
      'params.preset',
      'incomingCall',
    );
    expect(mockOnUpdate).toHaveBeenCalledWith(
      'action-notify',
      'params.message',
      NOTIFY_PRESETS.incomingCall,
    );
    expect(NOTIFY_PRESETS.incomingCall).toContain('${CALLERID(num)}');
  });

  it('updates message and optional target fields', () => {
    render(<NotifyApp action={baseAction} onUpdate={mockOnUpdate} />);

    fireEvent.change(screen.getByLabelText('Message template'), {
      target: { value: 'Custom ${EXTEN}' },
    });
    expect(mockOnUpdate).toHaveBeenCalledWith(
      'action-notify',
      'params.message',
      'Custom ${EXTEN}',
    );

    fireEvent.change(screen.getByLabelText('Target override (optional)'), {
      target: { value: '-1001' },
    });
    expect(mockOnUpdate).toHaveBeenCalledWith('action-notify', 'params.target', '-1001');
  });
});
