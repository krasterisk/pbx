import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SA_INDUSTRY_TEMPLATES } from '@krasterisk/shared';
import { MetricEditor } from '@/features/speechAnalytics/ui/MetricEditor';
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
  saveLoading: boolean;
  refetch: ReturnType<typeof vi.fn>;
} = {
  data: [],
  isLoading: false,
  isError: false,
  saveLoading: false,
  refetch: vi.fn(),
};

vi.mock('@/features/speechAnalytics/api/speechAnalyticsApi', () => ({
  useGetSaProjectsQuery: () => ({
    data: projectsState.data,
    isLoading: projectsState.isLoading,
    isError: projectsState.isError,
    refetch: projectsState.refetch,
  }),
  useCreateSaProjectMutation: () => [vi.fn(() => ({ unwrap: () => Promise.resolve({ id: 'new', draft_revision: 1 }) })), { isLoading: false }],
  useBulkDeleteSaProjectsMutation: () => [vi.fn(() => ({ unwrap: () => Promise.resolve({ deleted: true }) })), { isLoading: false }],
  usePublishSaProjectMutation: () => [vi.fn(), { isLoading: projectsState.saveLoading === true }],
  useSetSaProjectIntakeMutation: () => [vi.fn(), {}],
  useUpdateSaProjectDraftMutation: () => [vi.fn(), { isLoading: projectsState.saveLoading === true }],
  useTestSaProjectWebhookMutation: () => [vi.fn(), { isLoading: false }],
}));

vi.mock('@/shared/api/endpoints/notificationApi', () => ({
  useGetNotificationsQuery: () => ({ data: [], isLoading: false }),
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
    projectsState.saveLoading = false;
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
    expect(screen.getByRole('button', { name: 'common.edit' })).toHaveAttribute('title', 'common.edit');
    expect(screen.getByRole('button', { name: 'common.copy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.delete' })).toBeInTheDocument();
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

describe('MetricEditor (via projects verify path)', () => {
  beforeEach(() => {
    projectsState.data = [
      { id: 'p1', name: 'Pilot', status: 'draft', draft_revision: 1, active_version_id: null },
    ];
    projectsState.saveLoading = false;
  });

  it('renders D-25 templates and disables publish while saving', () => {
    projectsState.saveLoading = true;
    render(
      <MemoryRouter>
        <MetricEditor projectId="p1" />
      </MemoryRouter>,
    );
    for (const templateId of SA_INDUSTRY_TEMPLATES) {
      expect(screen.getByTestId(`sa-template-${templateId}`)).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Опубликовать проект' })).toBeDisabled();
  });
});
