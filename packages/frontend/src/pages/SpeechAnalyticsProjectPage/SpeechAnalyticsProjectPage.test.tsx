import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SpeechAnalyticsProjectPage } from './SpeechAnalyticsProjectPage';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string | Record<string, unknown>) => {
      if (typeof defaultValue === 'string') return defaultValue;
      return key;
    },
  }),
}));

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const projectRow = {
  id: 'p1',
  name: 'Pilot',
  status: 'draft' as const,
  draft_revision: 1,
  active_version_id: null as string | null,
  draft_config: null as Record<string, unknown> | null,
};

vi.mock('@/features/speechAnalytics/api/speechAnalyticsApi', () => ({
  useGetSaProjectsQuery: () => ({
    data: [projectRow],
    isLoading: false,
    isError: false,
  }),
  useUpdateSaProjectDraftMutation: () => [vi.fn(), { isLoading: false }],
  usePublishSaProjectMutation: () => [vi.fn(), { isLoading: false }],
  useTestSaProjectWebhookMutation: () => [vi.fn(), { isLoading: false }],
}));

vi.mock('@/shared/api/endpoints/notificationApi', () => ({
  useGetNotificationsQuery: () => ({ data: [], isLoading: false }),
}));

describe('SpeechAnalyticsProjectPage', () => {
  it('renders metric editor shell for a project', () => {
    render(
      <MemoryRouter initialEntries={['/speech-analytics/projects/p1']}>
        <Routes>
          <Route path="/speech-analytics/projects/:id" element={<SpeechAnalyticsProjectPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('speech-analytics-project')).toBeInTheDocument();
    expect(screen.getByTestId('sa-metric-editor')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Опубликовать проект' })).toBeInTheDocument();
  });
});
