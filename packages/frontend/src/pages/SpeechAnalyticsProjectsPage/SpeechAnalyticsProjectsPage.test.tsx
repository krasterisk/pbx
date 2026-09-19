import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SpeechAnalyticsProjectsPage } from './SpeechAnalyticsProjectsPage';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock('@/features/speechAnalytics/api/speechAnalyticsApi', () => ({
  useGetSaProjectsQuery: () => ({
    data: [{ id: 'p1', name: 'Pilot', status: 'active', draft_revision: 1, active_version_id: 'v1' }],
    isLoading: false,
  }),
  useCreateSaProjectMutation: () => [vi.fn(), {}],
  usePublishSaProjectMutation: () => [vi.fn()],
  useSetSaProjectIntakeMutation: () => [vi.fn()],
}));

describe('SpeechAnalyticsProjectsPage', () => {
  it('renders projects and an intake switch', () => {
    render(
      <MemoryRouter>
        <SpeechAnalyticsProjectsPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('speech-analytics-projects')).toBeInTheDocument();
    expect(screen.getByText('Pilot')).toBeInTheDocument();
  });
});
