import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SpeechAnalyticsProjectsPage } from './SpeechAnalyticsProjectsPage';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string | Record<string, unknown>) => {
      if (typeof defaultValue === 'string') return defaultValue;
      return key;
    },
    i18n: { language: 'ru' },
  }),
}));

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock('@/shared/hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}));

const projectsState: {
  data: Array<{
    id: string;
    name: string;
    status: string;
    draft_revision: number;
    active_version_id: string | null;
  }>;
  isLoading: boolean;
  isError: boolean;
  refetch: ReturnType<typeof vi.fn>;
} = {
  data: [],
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
};

vi.mock('@/features/speechAnalytics/api/speechAnalyticsApi', () => ({
  useGetSaProjectsQuery: () => ({
    data: projectsState.data,
    isLoading: projectsState.isLoading,
    isError: projectsState.isError,
    refetch: projectsState.refetch,
  }),
  useCreateSaProjectMutation: () => [vi.fn(() => ({ unwrap: () => Promise.resolve({ id: 'new' }) })), { isLoading: false }],
  usePublishSaProjectMutation: () => [vi.fn(), { isLoading: false }],
  useSetSaProjectIntakeMutation: () => [vi.fn(), {}],
  useUpdateSaProjectDraftMutation: () => [vi.fn(), { isLoading: false }],
  useTestSaProjectWebhookMutation: () => [vi.fn(), { isLoading: false }],
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <SpeechAnalyticsProjectsPage />
    </MemoryRouter>,
  );
}

describe('SpeechAnalyticsProjectsPage', () => {
  beforeEach(() => {
    projectsState.data = [];
    projectsState.isLoading = false;
    projectsState.isError = false;
    projectsState.refetch = vi.fn();
  });

  it('shows empty projects heading and create CTA when list is empty', () => {
    renderPage();

    expect(screen.getByTestId('speech-analytics-projects')).toBeInTheDocument();
    expect(screen.getByText('Проектов пока нет')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Создайте проект и опубликуйте метрики, чтобы маршруты и загрузки могли брать этот набор.',
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Создать проект' }).length).toBeGreaterThanOrEqual(1);
  });

  it('shows a loader while projects are loading', () => {
    projectsState.isLoading = true;
    renderPage();

    expect(screen.getByTestId('projects-loading')).toBeInTheDocument();
  });

  it('shows error text and retry when projects fail to load', async () => {
    const user = userEvent.setup();
    projectsState.isError = true;
    renderPage();

    expect(screen.getByTestId('projects-error')).toBeInTheDocument();
    expect(screen.getByText(/Не удалось загрузить проекты/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Повторить|retry/i }));
    expect(projectsState.refetch).toHaveBeenCalled();
  });

  it('keeps the create CTA when the list has one project', () => {
    projectsState.data = [
      { id: 'p1', name: 'Pilot', status: 'active', draft_revision: 1, active_version_id: 'v1' },
    ];
    renderPage();
    expect(screen.getByText('Pilot')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Создать проект' }).length).toBeGreaterThanOrEqual(1);
  });

  it('keeps the create CTA when the list has many projects', () => {
    projectsState.data = [
      { id: 'p1', name: 'Pilot', status: 'active', draft_revision: 1, active_version_id: 'v1' },
      { id: 'p2', name: 'Debt', status: 'draft', draft_revision: 2, active_version_id: null },
      { id: 'p3', name: 'Appt', status: 'active', draft_revision: 1, active_version_id: 'v3' },
    ];
    renderPage();
    expect(screen.getByText('Debt')).toBeInTheDocument();
    expect(screen.getByText('Appt')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Создать проект' }).length).toBeGreaterThanOrEqual(1);
  });
});
