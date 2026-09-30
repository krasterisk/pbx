import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SpeechAnalyticsDashboardPage } from './SpeechAnalyticsDashboardPage';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

const {
  requestInsights,
  navigate,
  drillDashboard,
  dashboardState,
  insightsMutationState,
  projectsState,
  authState,
} = vi.hoisted(() => ({
  requestInsights: vi.fn(),
  navigate: vi.fn(),
  drillDashboard: vi.fn(),
  authState: { superAdmin: false },
  dashboardState: {
    data: {
      scored: 12,
      ranking: 'ok',
      filterDigest: 'digest-1',
      conversationCount: 12,
      costTotal: '10.00',
      lowSttCount: 2,
      sentiment: { positive: 5, neutral: 4, negative: 3 },
      successRate: 0.7,
      metrics: [
        { id: 'greeting', label: 'Greeting', avg: 80 },
        { id: 'needs', label: 'Needs', avg: 60 },
      ],
      dynamics: [{ label: 'Mon', avgScore: 70, calls: 4 }],
    } as {
      scored: number;
      ranking: string;
      filterDigest: string;
      conversationCount: number;
      costTotal: string;
      lowSttCount: number;
      sentiment?: { positive: number; neutral: number; negative: number };
      successRate?: number;
      metrics?: Array<{ id: string; label?: string; avg: number }>;
      dynamics?: Array<{ label: string; avgScore: number; calls: number }>;
      calls?: Array<{
        id: string;
        occurredAt: string;
        dayLabel: string;
        operatorName: string | null;
        callerPhone: string | null;
        score: number | null;
        success: boolean | null;
        sentiment: 'positive' | 'neutral' | 'negative' | null;
        lowStt: boolean;
        latestAmount: string | null;
        currency: string | null;
        topics: string[];
        metrics: Array<{ id: string; value: number; rationale: string }>;
      }>;
    },
  },
  projectsState: {
    data: [{ id: 'p1', name: 'Медцентр', status: 'active', recordingCount: 21 }] as Array<{
      id: string;
      name: string;
      status: string;
      recordingCount: number;
    }>,
  },
  insightsMutationState: {
    isLoading: false,
    isError: false,
    data: undefined as unknown,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
}));

vi.mock('@/entities/User', () => ({
  selectIsSuperAdmin: () => authState.superAdmin,
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppSelector: (selector: () => unknown) => selector(),
}));

vi.mock('@/features/speechAnalytics/api/speechAnalyticsApi', () => ({
  cabinetSaProjects: (rows: Array<{ status?: string }> | undefined) =>
    (rows ?? []).filter((project) => project.status !== 'archived'),
  useGetSaProjectsQuery: () => ({ data: projectsState.data }),
  useGetSaDashboardQuery: () => ({
    data: dashboardState.data,
    isLoading: false,
    isUninitialized: false,
  }),
  useRequestSaInsightsMutation: () => [requestInsights, insightsMutationState],
  useDrillSaDashboardMutation: () => [drillDashboard, { isLoading: false }],
  useGetSaConversationQuery: () => ({
    data: {
      id: 'rec-1',
      sourceKind: 'upload',
      audioUrl: null,
      summary: 'Запись на приём',
      metricResults: [{ id: 'greeting_quality', value: 75, rationale: 'есть приветствие' }],
      transcriptText: 'Здравствуйте',
      turns: [{ speaker: 'operator', text: 'Здравствуйте', startMs: 0, endMs: 1000 }],
      rebuildInProgress: false,
      runs: [],
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

describe('SpeechAnalyticsDashboardPage insights (D-35)', () => {
  beforeEach(() => {
    authState.superAdmin = false;
    requestInsights.mockReset();
    navigate.mockReset();
    drillDashboard.mockReset();
    drillDashboard.mockImplementation(() => ({
      unwrap: () => Promise.resolve({ calls: dashboardState.data.calls ?? [] }),
    }));
    projectsState.data = [{ id: 'p1', name: 'Медцентр', status: 'active', recordingCount: 21 }];
    navigate.mockReset();
    dashboardState.data = {
      scored: 12,
      ranking: 'ok',
      filterDigest: 'digest-1',
      conversationCount: 12,
      costTotal: '10.00',
      lowSttCount: 2,
      sentiment: { positive: 5, neutral: 4, negative: 3 },
      successRate: 0.7,
      metrics: [
        { id: 'greeting', label: 'Greeting', avg: 80 },
        { id: 'needs', label: 'Needs', avg: 60 },
      ],
      dynamics: [{ label: 'Mon', avgScore: 70, calls: 4 }],
    };
    insightsMutationState.isLoading = false;
    insightsMutationState.isError = false;
    insightsMutationState.data = undefined;
  });

  it('shows Get insights CTA and does not fetch insights on mount', () => {
    render(<SpeechAnalyticsDashboardPage />);
    expect(screen.getByTestId('speech-analytics-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('sa-get-insights')).toBeInTheDocument();
    expect(screen.queryByText('Плохое распознавание')).not.toBeInTheDocument();
    expect(requestInsights).not.toHaveBeenCalled();
  });

  it('shows empty insights copy when fewer than 10 conversations and does not call the model', async () => {
    dashboardState.data = {
      ...dashboardState.data,
      scored: 3,
      ranking: 'insufficient_sample',
      conversationCount: 3,
      costTotal: '1.00',
      lowSttCount: 0,
    };
    render(<SpeechAnalyticsDashboardPage />);
    expect(screen.getByText(/после 20 разговоров/)).toBeInTheDocument();
    expect(screen.queryByText(/insufficient_sample/)).not.toBeInTheDocument();
    expect(screen.getByTestId('dashboard-project-name')).toHaveTextContent('Медцентр');
    expect(screen.getByTestId('sa-insights-empty')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('sa-get-insights'));
    expect(requestInsights).not.toHaveBeenCalled();
  });

  it('keeps previous insights on screen while busy and hides any charge fields', () => {
    insightsMutationState.isLoading = true;
    insightsMutationState.data = {
      status: 'ok',
      insights: [
        {
          type: 'gap',
          title: 'Пробел',
          observation: 'Низкий успех',
          recommendation: 'Тренинг',
          evidence: { metric: 'successRate', value: 40, operators: [], periodLabel: '' },
        },
      ],
      amount: '0.40',
      currency: 'RUB',
    };

    render(<SpeechAnalyticsDashboardPage />);

    expect(screen.getByTestId('sa-insights-busy')).toBeInTheDocument();
    expect(screen.getByText('Пробел')).toBeInTheDocument();
    expect(screen.getByText('Просадка')).toBeInTheDocument();
    expect(screen.getByText('Что видно')).toBeInTheDocument();
    expect(screen.getByText('Что сделать')).toBeInTheDocument();
    expect(screen.queryByTestId('sa-insights-cost-label')).not.toBeInTheDocument();
    expect(screen.queryByText('Посчитано, не списано')).not.toBeInTheDocument();
    expect(screen.queryByText(/0\.40/)).not.toBeInTheDocument();
  });

  it('sends the selected period and does not send a conversation count', async () => {
    requestInsights.mockImplementation(() => ({
      unwrap: () => Promise.resolve({ status: 'ok', insights: [] }),
    }));
    render(<SpeechAnalyticsDashboardPage />);
    await userEvent.click(screen.getByTestId('sa-get-insights'));
    expect(requestInsights).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'p1',
      from: expect.any(String),
      to: expect.any(String),
    }));
    const body = requestInsights.mock.calls[0][0] as Record<string, unknown>;
    expect(body).not.toHaveProperty('conversationCount');
    expect(body).not.toHaveProperty('filterDigest');
  });

  it('shows the only project name and opens the conversations behind a metric', async () => {
    dashboardState.data = {
      ...dashboardState.data,
      metrics: [{ id: 'greeting_quality', label: 'Приветствие', avg: 75 }],
      calls: [{
        id: 'rec-1',
        occurredAt: '2026-09-28T10:00:00.000Z',
        dayLabel: '2026-09-28',
        operatorName: 'Татьяна',
        callerPhone: '100',
        score: 4,
        success: true,
        sentiment: 'positive',
        lowStt: false,
        latestAmount: '1.00',
        currency: 'RUB',
        topics: [],
        metrics: [{ id: 'greeting_quality', value: 75, rationale: 'есть приветствие' }],
      }],
    };
    render(<SpeechAnalyticsDashboardPage />);
    expect(screen.getByTestId('dashboard-project-name')).toHaveTextContent('Медцентр');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Приветствие/ }));
    expect(await screen.findByText('есть приветствие')).toBeInTheDocument();
    expect(screen.getByText('Дата')).toBeInTheDocument();
    expect(screen.getByText('Номер')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('Обоснование')).toBeInTheDocument();
    expect(drillDashboard).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'p1',
      drill: expect.objectContaining({ type: 'metric', metricId: 'greeting_quality' }),
    }));
    await userEvent.click(screen.getByRole('button', { name: /есть приветствие/ }));
    expect(await screen.findByTestId('dashboard-call-panel')).toBeInTheDocument();
    expect(screen.getByText('Аналитика')).toBeInTheDocument();
    expect(screen.getByText('Расшифровка')).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows poor recognition only to a superadmin', () => {
    authState.superAdmin = true;
    render(<SpeechAnalyticsDashboardPage />);
    expect(screen.getByRole('button', { name: /Плохое распознавание/ })).toBeInTheDocument();
  });

  it('offers a project select when the cabinet has several projects', () => {
    projectsState.data = [
      { id: 'p1', name: 'Медцентр', status: 'active', recordingCount: 21 },
      { id: 'p2', name: 'Pilot', status: 'active', recordingCount: 0 },
    ];
    render(<SpeechAnalyticsDashboardPage />);
    expect(screen.getByRole('combobox', { name: 'Проект' })).toHaveValue('p1');
    expect(screen.queryByTestId('dashboard-project-name')).not.toBeInTheDocument();
  });
});
