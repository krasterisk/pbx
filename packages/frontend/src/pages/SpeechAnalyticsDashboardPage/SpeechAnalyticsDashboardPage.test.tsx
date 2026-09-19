import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SpeechAnalyticsDashboardPage } from './SpeechAnalyticsDashboardPage';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/features/speechAnalytics/api/speechAnalyticsApi', () => ({
  useGetSaProjectsQuery: () => ({ data: [{ id: 'p1' }] }),
  useGetSaDashboardQuery: () => ({ data: { scored: 0, ranking: 'insufficient_sample', filterDigest: 'x' } }),
  useGetSaCapturePolicyQuery: () => ({ data: { pause_new: false, default_enabled: false, revision: 0 } }),
  useSetSaCapturePolicyMutation: () => [vi.fn()],
}));

describe('SpeechAnalyticsDashboardPage', () => {
  it('renders dashboard contract', () => {
    render(<SpeechAnalyticsDashboardPage />);
    expect(screen.getByTestId('speech-analytics-dashboard')).toBeInTheDocument();
    expect(screen.getByText('insufficient_sample', { exact: false })).toBeInTheDocument();
  });
});
