import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SA_INDUSTRY_TEMPLATES } from '@krasterisk/shared';
import { MetricEditor } from './MetricEditor';

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

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppSelector: () => 2,
}));

const draftState = {
  isLoading: false,
  isError: false,
  saveLoading: false,
  publishLoading: false,
  project: {
    id: 'p1',
    name: 'Pilot',
    status: 'draft' as const,
    draft_revision: 1,
    active_version_id: null as string | null,
    draft_config: null as Record<string, unknown> | null,
  },
};

vi.mock('../api/speechAnalyticsApi', () => ({
  useGetSaProjectsQuery: () => ({
    data: [draftState.project],
    isLoading: draftState.isLoading,
    isError: draftState.isError,
    refetch: vi.fn(),
  }),
  useGetSaMetricsQuery: () => ({ data: [], isLoading: false }),
  usePublishSaMetricMutation: () => [vi.fn(), { isLoading: false }],
  useUpdateSaProjectDraftMutation: () => [
    vi.fn(() => ({ unwrap: () => Promise.resolve(draftState.project) })),
    { isLoading: draftState.saveLoading },
  ],
  usePublishSaProjectMutation: () => [
    vi.fn(() => ({ unwrap: () => Promise.resolve({}) })),
    { isLoading: draftState.publishLoading },
  ],
  useTestSaProjectWebhookMutation: () => [vi.fn(), { isLoading: false }],
}));

vi.mock('@/shared/api/endpoints/notificationApi', () => ({
  useGetNotificationsQuery: () => ({ data: [], isLoading: false }),
}));

function renderEditor(canEditModels = false) {
  return render(
    <MemoryRouter>
      <MetricEditor projectId="p1" canEditModels={canEditModels} />
    </MemoryRouter>,
  );
}

describe('MetricEditor', () => {
  beforeEach(() => {
    draftState.isLoading = false;
    draftState.isError = false;
    draftState.saveLoading = false;
    draftState.publishLoading = false;
  });

  it('renders every D-25 industry template and editor sections', async () => {
    const user = userEvent.setup();
    renderEditor();

    expect(screen.getByTestId('sa-metric-editor')).toBeInTheDocument();
    for (const templateId of SA_INDUSTRY_TEMPLATES) {
      expect(screen.getByTestId(`sa-template-${templateId}`)).toBeInTheDocument();
    }

    await user.click(screen.getByRole('tab', { name: 'Метрики' }));
    expect(screen.getByTestId('sa-section-custom-metrics')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Шкалы' }));
    expect(screen.getByTestId('sa-section-scales')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Промпт' }));
    expect(screen.getByTestId('sa-section-system-prompt')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Темы' }));
    expect(screen.getByTestId('sa-section-topics')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Вебхук' }));
    expect(screen.getByTestId('sa-section-webhook')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Дайджест' }));
    expect(screen.getByTestId('sa-section-digest')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Интеграции|Integrations/i })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Алерты' }));
    expect(screen.getByTestId('sa-section-alerts')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Бюджет' }));
    expect(screen.getByTestId('sa-section-budget')).toBeInTheDocument();

    expect(screen.queryByTestId('sa-section-models')).not.toBeInTheDocument();
  });

  it('disables publish while a draft save is in flight', () => {
    draftState.saveLoading = true;
    renderEditor();

    const publish = screen.getByRole('button', { name: 'Опубликовать проект' });
    expect(publish).toBeDisabled();
  });

  it('shows model override fields only when the cabinet right is on', async () => {
    const user = userEvent.setup();
    renderEditor(true);
    await user.click(screen.getByRole('tab', { name: 'Модели' }));
    expect(screen.getByTestId('sa-section-models')).toBeInTheDocument();
  });
});
