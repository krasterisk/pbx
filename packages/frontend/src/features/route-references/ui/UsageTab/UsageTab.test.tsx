import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { IRoute } from '@krasterisk/shared';
import type { RouteUsageResponse } from '@/shared/api/endpoints/routeReferencesApi';
import { UsageTab, formatReferenceLocation } from './UsageTab';

const usageState: {
  data?: RouteUsageResponse;
  isLoading: boolean;
  isError: boolean;
} = {
  data: undefined,
  isLoading: false,
  isError: false,
};

const routesState: { data: IRoute[] } = { data: [] };

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string, options?: Record<string, unknown>) => {
      if (typeof fallback !== 'string') return key;
      if (!options) return fallback;
      return fallback.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(options[name] ?? ''));
    },
  }),
}));

vi.mock('@/shared/api/endpoints/routeReferencesApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/endpoints/routeReferencesApi')>();
  return {
    ...actual,
    useGetUsageQuery: () => usageState,
  };
});

vi.mock('@/shared/api/endpoints/routeApi', () => ({
  useGetAllRoutesQuery: () => routesState,
}));

const inbound: IRoute = {
  uid: 5,
  context_uid: 1,
  name: 'Inbound',
  extensions: ['100'],
  priority: 1,
  active: 1,
  options: null,
  webhooks: null,
  actions: [{ id: 'a1', type: 'toivr', params: { ivr_uid: 7 }, condition: {} }],
  raw_dialplan: null,
  user_uid: 1,
  created_at: '',
  updated_at: '',
};

describe('UsageTab (D-48 / Surface O)', () => {
  beforeEach(() => {
    usageState.data = {
      references: [],
      hasRawDialplanRoutes: false,
      meta: { hasRawDialplanRoutes: false },
    };
    usageState.isLoading = false;
    usageState.isError = false;
    routesState.data = [];
  });

  it('renders referencing routes as cards with location badge and external link', () => {
    usageState.data = {
      references: [{ routeUid: 5, actionOrBindingId: 'a1', location: 'Route 5 action a1' }],
      hasRawDialplanRoutes: false,
      meta: { hasRawDialplanRoutes: false },
    };
    routesState.data = [inbound];

    render(<UsageTab kind="ivr" uid={7} />);

    expect(screen.getByTestId('usage-tab')).toBeInTheDocument();
    expect(screen.getByText('Inbound')).toBeInTheDocument();
    expect(screen.getByText('Действие 1, toivr')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Открыть в новой вкладке' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('href', '/routes');
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('shows empty copy and raw_dialplan caveat when meta.hasRawDialplanRoutes is true', () => {
    usageState.data = {
      references: [],
      hasRawDialplanRoutes: true,
      meta: { hasRawDialplanRoutes: true },
    };

    render(<UsageTab kind="ivr" uid={7} />);

    expect(screen.getByText('Нигде не используется')).toBeInTheDocument();
    expect(screen.getByText(/можно удалить без последствий/)).toBeInTheDocument();
    expect(screen.getByTestId('usage-tab-raw-dialplan-caveat')).toHaveTextContent(
      'В тенанте есть маршруты с рукописным диалпланом',
    );
  });

  it('shows toroute pattern caveat on the route host', () => {
    render(<UsageTab kind="route" uid={5} showTorouteCaveat />);

    expect(screen.getByTestId('usage-tab-toroute-caveat')).toHaveTextContent(
      'На маршрут могут ссылаться по шаблону номера',
    );
  });

  it('shows skeleton while the index is loading', () => {
    usageState.isLoading = true;
    usageState.data = undefined;
    render(<UsageTab kind="ivr" uid={7} />);
    expect(screen.getByText('Ищем ссылки')).toBeInTheDocument();
  });

  it('shows error copy when the index fails', () => {
    usageState.isError = true;
    usageState.data = undefined;
    render(<UsageTab kind="ivr" uid={7} />);
    expect(screen.getByTestId('usage-tab-error')).toHaveTextContent('Не удалось проверить ссылки');
  });

  it('marks an inactive route with a Disabled badge', () => {
    usageState.data = {
      references: [{ routeUid: 5, actionOrBindingId: 'a1', location: 'Route 5 action a1' }],
      hasRawDialplanRoutes: false,
      meta: { hasRawDialplanRoutes: false },
    };
    routesState.data = [{ ...inbound, active: 0 }];
    render(<UsageTab kind="ivr" uid={7} />);
    expect(screen.getByText('Выключен')).toBeInTheDocument();
  });

  it('formats a directory binding as Route directories', () => {
    const label = formatReferenceLocation(
      { routeUid: 5, actionOrBindingId: '12', location: 'Route 5 binding 12' },
      inbound,
      (key, fallback) => fallback,
    );
    expect(label).toBe('Справочники маршрута');
  });
});
