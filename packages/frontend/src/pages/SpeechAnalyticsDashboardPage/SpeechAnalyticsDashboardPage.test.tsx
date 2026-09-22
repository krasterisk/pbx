import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SpeechAnalyticsDashboardPage } from './SpeechAnalyticsDashboardPage';

const requestInsights = vi.fn();
const navigate = vi.fn();

let dashboardData: {
  scored: number;
  ranking: string;
  filterDigest: string;
  conversationCount: number;
  costTotal: string;
  lowSttCount: number;
  sentiment?: { positive: number; neutral: number; negative: number };
  successRate?: number;
  scales?: Array<{ key: string; avg: number }>;
  customMetrics?: Array<{ id: string; label: string; avg: number }>;
  dynamics?: Array<{ label: string; avgScore: number; calls: number }>;
};

let insightsMutationState: {
  isLoading: boolean;
  isError: boolean;
  data: unknown;
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
}));

vi.mock('@/features/speechAnalytics/api/speechAnalyticsApi', () => ({
  useGetSaProjectsQuery: () => ({ data: [{ id: 'p1', name: 'Demo' }] }),
  useGetSaDashboardQuery: () => ({
    data: dashboardData,
    isLoading: false,
  }),
  useGetSaCapturePolicyQuery: () => ({
    data: { pause_new: false, default_enabled: false, revision: 0 },
  }),
  useSetSaCapturePolicyMutation: () => [vi.fn()],
  useRequestSaInsightsMutation: () => [requestInsights, insightsMutationState],
}));

describe('SpeechAnalyticsDashboardPage insights (D-35)', () => {
  beforeEach(() => {
    requestInsights.mockReset();
    navigate.mockReset();
    dashboardData = {
      scored: 12,
      ranking: 'ok',
      filterDigest: 'digest-1',
      conversationCount: 12,
      costTotal: '10.00',
      lowSttCount: 2,
      sentiment: { positive: 5, neutral: 4, negative: 3 },
      successRate: 0.7,
      scales: [{ key: 'greeting', avg: 80 }],
      customMetrics: [{ id: 'needs', label: 'Needs', avg: 60 }],
      dynamics: [{ label: 'Mon', avgScore: 70, calls: 4 }],
    };
    insightsMutationState = {
      isLoading: false,
      isError: false,
      data: undefined,
    };
  });

  it('shows Get insights CTA and does not fetch insights on mount', () => {
    render(<SpeechAnalyticsDashboardPage />);
    expect(screen.getByTestId('speech-analytics-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('sa-get-insights')).toBeInTheDocument();
    expect(requestInsights).not.toHaveBeenCalled();
  });

  it('shows empty insights copy when fewer than 10 conversations and does not call the model', async () => {
    dashboardData = {
      ...dashboardData,
      scored: 3,
      ranking: 'insufficient_sample',
      conversationCount: 3,
      costTotal: '1.00',
      lowSttCount: 0,
    };
    render(<SpeechAnalyticsDashboardPage />);
    expect(screen.getByTestId('sa-insights-empty')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('sa-get-insights'));
    expect(requestInsights).not.toHaveBeenCalled();
  });

  it('keeps previous insights on screen while busy and labels cost as not charged', async () => {
    requestInsights.mockImplementation(async () => ({
      unwrap: async () => ({
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
        fromCache: false,
      }),
    }));

    const { rerender } = render(<SpeechAnalyticsDashboardPage />);
    await userEvent.click(screen.getByTestId('sa-get-insights'));
    await waitFor(() => expect(requestInsights).toHaveBeenCalled());

    insightsMutationState = {
      isLoading: true,
      isError: false,
      data: {
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
      },
    };
    rerender(<SpeechAnalyticsDashboardPage />);

    expect(screen.getByTestId('sa-insights-busy')).toBeInTheDocument();
    expect(screen.getByText('Пробел')).toBeInTheDocument();
    expect(screen.getByTestId('sa-insights-cost-label')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-cost-total').textContent).not.toContain('0.40');
  });
});
