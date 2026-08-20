import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NotifyApp } from './NotifyApp';
import { ActionTypeSelect } from '../../ActionTypeSelect';
import { dialplanAppsRegistry } from '../../../model/registry';

const mockOnChange = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

vi.mock('@/shared/ui/Tooltip/Tooltip', () => ({
  InfoTooltip: ({ text }: { text: string }) => <span role="note">{text}</span>,
}));

vi.mock('@/shared/api/endpoints/notificationApi', () => ({
  useGetNotificationsQuery: vi.fn(() => ({ data: [] })),
}));

describe('NotifyApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lets the user pick several channels and shows a recipient field for each', () => {
    render(
      <NotifyApp
        params={{ channels: ['email', 'telegram'], recipients: {}, body: '' }}
        onChange={mockOnChange}
      />,
    );

    expect(screen.getByLabelText(/каналы|channels/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/telegram|chat/i)).toBeInTheDocument();
  });

  it('omits sendmail, sendmailpeer and telegram from create select after hard-remove', () => {
    render(<ActionTypeSelect value="" onChange={vi.fn()} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    const values = Array.from(select.options).map((option) => option.value);
    expect(values).not.toContain('sendmail');
    expect(values).not.toContain('sendmailpeer');
    expect(values).not.toContain('telegram');
    expect(dialplanAppsRegistry).not.toHaveProperty('sendmail');
    expect(dialplanAppsRegistry).not.toHaveProperty('telegram');
  });
});
