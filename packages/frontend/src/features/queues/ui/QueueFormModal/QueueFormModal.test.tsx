import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { RootState } from '@/app/store/store';

const mockDispatch = vi.fn();
let mockState: Partial<RootState>;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (selector: (state: RootState) => unknown) => selector(mockState as RootState),
}));

const mockQueue = { name: 'sales', displayname: 'Sales', exten: '700', strategy: 'ringall' };

vi.mock('@/shared/api/endpoints/queueApi', () => ({
  useGetQueueQuery: () => ({
    data: mockQueue,
    isFetching: false,
  }),
  useCreateQueueMutation: () => [vi.fn(), { isLoading: false }],
  useUpdateQueueMutation: () => [vi.fn(), { isLoading: false }],
  useDeleteQueueMutation: () => [vi.fn(), { isLoading: false }],
}));

vi.mock('@/shared/api/endpoints/routeReferencesApi', () => ({
  useGetUsageQuery: () => ({
    data: { references: [], hasRawDialplanRoutes: false, meta: { hasRawDialplanRoutes: false } },
    isLoading: false,
    isError: false,
  }),
  extractRouteReferences: () => [],
}));

vi.mock('@/shared/api/endpoints/contextApi', () => ({
  useGetContextsQuery: () => ({ data: [] }),
}));

vi.mock('@/shared/api/endpoints/promptsApi', () => ({
  useGetPromptsQuery: () => ({ data: [] }),
}));

vi.mock('@/shared/api/endpoints/mohApi', () => ({
  useGetMohClassesQuery: () => ({ data: [] }),
}));

vi.mock('@/shared/api/api', () => ({
  useGetEndpointsQuery: () => ({ data: [] }),
}));

vi.mock('@/features/endpoints/ui/AdvancedSettingsBuilder', () => ({
  AdvancedSettingsBuilder: () => null,
}));

vi.mock('@radix-ui/react-dialog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@radix-ui/react-dialog')>();
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    ...actual,
    Root: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Portal: Passthrough,
    Overlay: () => null,
    Content: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Title: ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>,
    Close: Passthrough,
    Trigger: Passthrough,
    Description: Passthrough,
  };
});

vi.mock('@/features/route-references/ui/UsageTab', () => ({
  UsageTab: () => <div data-testid="usage-tab" />,
}));

vi.mock('@/features/route-references/ui/DeleteBlockedDialog', () => ({
  DeleteBlockedDialog: () => null,
}));

import { QueueFormModal } from './QueueFormModal';

describe('QueueFormModal usage tab (D-48 / Surface O)', () => {
  beforeEach(() => {
    mockState = {
      queuesPage: {
        isModalOpen: true,
        modalMode: 'edit',
        selectedQueueName: 'sales',
      },
    } as Partial<RootState>;
  });

  it('appends Usage last in edit mode', () => {
    render(<QueueFormModal />);
    const usage = screen.getByText('Где используется');
    expect(usage).toBeInTheDocument();
    fireEvent.click(usage);
    expect(screen.getByTestId('usage-tab')).toBeInTheDocument();
  });

  it('does not render Usage in create mode', () => {
    mockState = {
      queuesPage: {
        isModalOpen: true,
        modalMode: 'create',
        selectedQueueName: null,
      },
    } as Partial<RootState>;
    render(<QueueFormModal />);
    expect(screen.queryByText('Где используется')).toBeNull();
  });
});
