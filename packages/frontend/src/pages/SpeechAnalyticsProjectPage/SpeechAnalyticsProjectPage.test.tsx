import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SpeechAnalyticsProjectPage } from './SpeechAnalyticsProjectPage';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-toastify', () => ({ toast: { error: vi.fn() } }));

vi.mock('@/features/speechAnalytics/api/speechAnalyticsApi', () => ({
  useGetSaRecordingsQuery: () => ({ data: [] }),
  useGetSaMetricsQuery: () => ({ data: [{ id: 'm1', metric_key: 'greeting_present' }] }),
  usePublishSaMetricMutation: () => [vi.fn()],
}));

describe('SpeechAnalyticsProjectPage', () => {
  it('renders metric editor', () => {
    render(
      <MemoryRouter initialEntries={['/speech-analytics/projects/p1']}>
        <Routes>
          <Route path="/speech-analytics/projects/:id" element={<SpeechAnalyticsProjectPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('speech-analytics-project')).toBeInTheDocument();
    expect(screen.getByTestId('sa-metric-editor')).toBeInTheDocument();
    expect(screen.getByText('greeting_present')).toBeInTheDocument();
  });
});
