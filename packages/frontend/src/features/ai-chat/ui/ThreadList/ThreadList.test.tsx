import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

type ThreadRow = {
  uid: number;
  title: string;
  status: 'active' | 'archived';
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
};

const listState = {
  threads: [] as ThreadRow[],
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
};

const createThread = vi.fn();
const deleteThread = vi.fn();

function thread(partial: Partial<ThreadRow> = {}): ThreadRow {
  return {
    uid: 1,
    title: 'Older chat',
    status: 'active',
    last_message_at: '2026-09-01T08:00:00.000Z',
    created_at: '2026-09-01T08:00:00.000Z',
    updated_at: '2026-09-01T08:00:00.000Z',
    ...partial,
  };
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/shared/api/endpoints/aiChatApi', () => ({
  useGetAiChatThreadsQuery: () => ({
    data: listState.threads,
    isLoading: listState.isLoading,
    isError: listState.isError,
    refetch: listState.refetch,
  }),
  useCreateAiChatThreadMutation: () => [
    (...args: unknown[]) => {
      createThread(...args);
      return {
        unwrap: async () => {
          const created = thread({
            uid: 99,
            title: '',
            last_message_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          listState.threads = [created, ...listState.threads];
          return created;
        },
      };
    },
    { isLoading: false },
  ],
  useDeleteAiChatThreadMutation: () => [
    (...args: unknown[]) => {
      deleteThread(...args);
      return { unwrap: async () => undefined };
    },
    { isLoading: false },
  ],
}));

import { ThreadList } from './ThreadList';

describe('ThreadList', () => {
  beforeEach(() => {
    listState.threads = [];
    listState.isLoading = false;
    listState.isError = false;
    listState.refetch.mockReset();
    createThread.mockReset();
    deleteThread.mockReset();
  });

  it('lists conversations newest first with title and relative time', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    listState.threads = [
      thread({ uid: 1, title: 'Older chat', last_message_at: threeDaysAgo }),
      thread({
        uid: 2,
        title: 'Newest chat',
        last_message_at: new Date().toISOString(),
      }),
    ];

    render(<ThreadList selectedUid={null} onSelect={vi.fn()} />);

    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveTextContent('Newest chat');
    expect(options[1]).toHaveTextContent('Older chat');
    expect(options[0]).toHaveTextContent('aiChat.relative.justNow');
    expect(options[1]).toHaveTextContent('aiChat.relative.days');
  });

  it('marks the selected conversation for assistive technology', () => {
    listState.threads = [
      thread({ uid: 1, title: 'First' }),
      thread({ uid: 2, title: 'Second', last_message_at: new Date().toISOString() }),
    ];

    render(<ThreadList selectedUid={2} onSelect={vi.fn()} />);

    const selected = screen.getByRole('option', { name: /Second/ });
    expect(selected).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: /First/ })).toHaveAttribute('aria-selected', 'false');
  });

  it('reports selection to the panel instead of owning it', () => {
    const onSelect = vi.fn();
    listState.threads = [thread({ uid: 4, title: "Yesterday's call" })];

    render(<ThreadList selectedUid={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('option', { name: /Yesterday's call/ }));

    expect(onSelect).toHaveBeenCalledWith(4);
  });

  it('creates a conversation and selects it so it appears at the top without a refresh', async () => {
    const onSelect = vi.fn();
    listState.threads = [thread({ uid: 1, title: 'Previous chat' })];

    const { rerender } = render(<ThreadList selectedUid={1} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'aiChat.newConversation' }));

    expect(createThread).toHaveBeenCalled();
    await vi.waitFor(() => expect(onSelect).toHaveBeenCalledWith(99));

    rerender(<ThreadList selectedUid={99} onSelect={onSelect} />);
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveTextContent('aiChat.untitled');
    expect(options[1]).toHaveTextContent('Previous chat');
  });

  it('shows skeleton rows while the list is loading and hides empty copy', () => {
    listState.isLoading = true;

    render(<ThreadList selectedUid={null} onSelect={vi.fn()} />);

    expect(screen.getAllByTestId('ai-agent-thread-skeleton')).toHaveLength(3);
    expect(screen.queryByText('aiChat.emptyTitle')).toBeNull();
    expect(screen.queryByText('aiChat.emptyBody')).toBeNull();
    expect(screen.queryByRole('option')).toBeNull();
  });

  it('shows empty-state copy and the new-conversation action when there are no threads', () => {
    render(<ThreadList selectedUid={null} onSelect={vi.fn()} />);

    expect(screen.getByText('aiChat.emptyTitle')).toBeInTheDocument();
    expect(screen.getByText('aiChat.emptyBody')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'aiChat.newConversation' })).toBeInTheDocument();
    expect(screen.queryByTestId('ai-agent-thread-skeleton')).toBeNull();
  });

  it('shows error copy and a retry that refires the list query', () => {
    listState.isError = true;

    render(<ThreadList selectedUid={null} onSelect={vi.fn()} />);

    expect(screen.getByText('aiChat.errorThreads')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'aiChat.retry' }));
    expect(listState.refetch).toHaveBeenCalledTimes(1);
  });

  it('asks for confirmation before deleting and keeps the conversation on dismiss', () => {
    listState.threads = [thread({ uid: 4, title: 'Keep me' })];

    render(<ThreadList selectedUid={4} onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'aiChat.deleteConversation' }));

    expect(screen.getByText('aiChat.deleteConfirmTitle')).toBeInTheDocument();
    expect(screen.getByText('aiChat.deleteConfirmBody')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'aiChat.keepConversation' }));

    expect(deleteThread).not.toHaveBeenCalled();
    expect(screen.getByRole('option', { name: /Keep me/ })).toBeInTheDocument();
  });

  it('removes the conversation after the confirm action', async () => {
    const onDeleted = vi.fn();
    listState.threads = [thread({ uid: 4, title: 'Remove me' })];

    render(<ThreadList selectedUid={4} onSelect={vi.fn()} onDeleted={onDeleted} />);
    fireEvent.click(screen.getByRole('button', { name: 'aiChat.deleteConversation' }));
    fireEvent.click(screen.getByRole('button', { name: 'aiChat.deleteConfirm' }));

    await vi.waitFor(() => expect(deleteThread).toHaveBeenCalledWith(4));
    expect(onDeleted).toHaveBeenCalledWith(4);
  });

  it('defines list, detail, create and delete queries with tag invalidation', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/shared/api/endpoints/aiChatApi.ts'),
      'utf8',
    );
    expect(src).toMatch(/getAiChatThreads/);
    expect(src).toMatch(/getAiChatThread:/);
    expect(src).toMatch(/createAiChatThread/);
    expect(src).toMatch(/deleteAiChatThread/);
    expect(src).toMatch(/query:\s*\(\)\s*=>\s*'\/ai-chat\/threads'/);
    expect(src).toMatch(/url:\s*`\/ai-chat\/threads\/\$\{/);
    expect(src).toMatch(/providesTags:[\s\S]*AiChatThreads/);
    expect(src).toMatch(/createAiChatThread[\s\S]*invalidatesTags/);
    expect(src).toMatch(/deleteAiChatThread[\s\S]*invalidatesTags/);
  });
});
