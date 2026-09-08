import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { AgentTimelineItem } from '@krasterisk/shared';

const tenantsState = {
  rows: [
    {
      id: 1,
      uid: 't-1',
      name: 'Acme',
      slug: 'acme',
      owner_user_id: 1,
      vpbx_user_uid: 42,
      status: 'active' as const,
      trial_ends_at: null,
      email: null,
      phone: null,
      company_inn: null,
      max_extensions: 10,
      max_trunks: 2,
      max_queues: 2,
      created_by: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
  ],
  count: 1,
};

const threadsState: { data: Array<{
  uid: number;
  title: string;
  status: 'active';
  last_message_at: string;
  created_at: string;
  updated_at: string;
  ownerName: string;
  readOnly: true;
}> } = { data: [] };

const AT = '2026-09-08T10:00:00.000Z';

const timeline: AgentTimelineItem[] = [
  { kind: 'user', id: 'm1', text: 'Создай IVR', createdAt: AT },
  { kind: 'assistant', id: 'm2', text: 'Готово', closeKind: 'complete', createdAt: AT },
];

const detailState: {
  data: {
    uid: number;
    title: string;
    status: 'active';
    last_message_at: string;
    created_at: string;
    updated_at: string;
    ownerName: string;
    readOnly: true;
    timeline: AgentTimelineItem[];
    cards: Record<string, never>;
  } | undefined;
} = { data: undefined };

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/shared/api/endpoints/cloudAdminApi', () => ({
  useGetTenantsQuery: () => ({ data: tenantsState, isLoading: false }),
}));

vi.mock('@/shared/api/endpoints/aiChatApi', () => ({
  useGetPlatformAiChatThreadsQuery: (_tenantUid: number, opts?: { skip?: boolean }) => ({
    data: opts?.skip ? undefined : threadsState.data,
    isLoading: false,
  }),
  useGetPlatformAiChatThreadQuery: (
    _arg: { tenantUid: number; uid: number },
    opts?: { skip?: boolean },
  ) => ({
    data: opts?.skip ? undefined : detailState.data,
    isLoading: false,
  }),
}));

vi.mock('@/features/ai-chat/ui/Timeline', () => ({
  TimelineList: ({
    readOnly,
    items,
  }: {
    readOnly?: boolean;
    items: AgentTimelineItem[];
  }) => (
    <div data-testid="ai-agent-timeline" data-readonly={readOnly ? 'true' : 'false'}>
      {items.map((item) => ('text' in item ? item.text : item.kind)).join(' ')}
    </div>
  ),
}));

import { PlatformAiThreadsPage } from './PlatformAiThreadsPage';

describe('PlatformAiThreadsPage', () => {
  beforeEach(() => {
    threadsState.data = [];
    detailState.data = undefined;
  });

  it('renders a tenant selector from cloud-admin tenants', () => {
    render(<PlatformAiThreadsPage />);

    const select = screen.getByRole('combobox', { name: 'platform.aiThreadsTenant' });
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Acme' })).toBeInTheDocument();
  });

  it('shows empty copy until a tenant has conversations', () => {
    render(<PlatformAiThreadsPage />);

    expect(screen.getByText('platform.aiThreadsEmpty')).toBeInTheDocument();
    expect(screen.queryByTestId('ai-agent-timeline')).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'platform.aiThreadsTenant' }), {
      target: { value: '42' },
    });

    expect(screen.getByText('platform.aiThreadsEmpty')).toBeInTheDocument();
  });

  it('renders a selected tenant thread as a read-only timeline', () => {
    threadsState.data = [{
      uid: 7,
      title: 'IVR',
      status: 'active',
      last_message_at: AT,
      created_at: AT,
      updated_at: AT,
      ownerName: 'Пётр',
      readOnly: true,
    }];
    detailState.data = {
      uid: 7,
      title: 'IVR',
      status: 'active',
      last_message_at: AT,
      created_at: AT,
      updated_at: AT,
      ownerName: 'Пётр',
      readOnly: true,
      timeline,
      cards: {},
    };

    render(<PlatformAiThreadsPage />);

    fireEvent.change(screen.getByRole('combobox', { name: 'platform.aiThreadsTenant' }), {
      target: { value: '42' },
    });
    fireEvent.click(screen.getByRole('option', { name: /IVR/ }));

    const timelineNode = screen.getByTestId('ai-agent-timeline');
    expect(timelineNode).toHaveAttribute('data-readonly', 'true');
    expect(timelineNode).toHaveTextContent('Создай IVR');
    expect(screen.queryByRole('button', { name: /apply|aiChat.card.apply/i })).toBeNull();
  });

  it('is mounted under /platform/ai-threads', () => {
    const src = readFileSync(join(process.cwd(), 'src/app/router/router.tsx'), 'utf8');
    expect(src).toMatch(/path: 'ai-threads'/);
    expect(src).toMatch(/PlatformAiThreadsPage/);
  });
});
