import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: { children?: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
}));

vi.mock('@/features/system-settings/ui/DialplanSubroutinesCard', () => ({
  DialplanSubroutinesCard: () => <div data-testid="dialplan-card-stub">dialplan</div>,
}));

vi.mock('@/features/system-settings/ui/RecordingsCard', () => ({
  RecordingsCard: () => <div data-testid="recordings-card-stub">recordings</div>,
}));

vi.mock('@/features/system-settings/ui/WebhookSecurityCard', () => ({
  WebhookSecurityCard: () => <div data-testid="webhook-card-stub">webhook</div>,
}));

vi.mock('@/features/system-settings/ui/FfmpegStatusCard', () => ({
  FfmpegStatusCard: () => <div data-testid="ffmpeg-card-stub">ffmpeg</div>,
}));

vi.mock('@/features/system-settings/ui/RedisStatusCard', () => ({
  RedisStatusCard: () => <div data-testid="redis-card-stub">redis</div>,
}));

import { SettingsPage } from './SettingsPage';

describe('SettingsPage stacked forms (D-29 / D-27 wave D)', () => {
  it('exposes phone stack marker for 360px Settings layout', () => {
    render(<SettingsPage />);
    const page = screen.getByTestId('settings-page-responsive');
    expect(page).toBeInTheDocument();
    expect(page).toHaveAttribute('data-stack', 'phone');
    expect(page.className).toMatch(/min-w-0|page/);
    expect(screen.getByTestId('dialplan-card-stub')).toBeInTheDocument();
  });
});
