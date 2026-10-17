import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HelpdeskChat } from './HelpdeskChat';

const mock = vi.hoisted(() => ({
    session: { currentData: { schema_version: 'support-session-v1', task: null, history: [] } as any, isError: false, isFetching: false, refetch: vi.fn() },
    send: vi.fn(), create: vi.fn(), query: vi.fn(),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/shared/api/endpoints/aiChatApi', () => ({
    useGetHelpdeskSessionQuery: (...args: unknown[]) => { mock.query(...args); return mock.session; },
    useSendHelpdeskMessageMutation: () => [mock.send, { isLoading: false }],
    useCreateAiChatThreadMutation: () => [mock.create, { isLoading: false }],
}));
describe('HelpdeskChat', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mock.session.currentData = { schema_version: 'support-session-v1', task: null, history: [] };
        mock.session.isError = false;
        mock.send.mockReturnValue({ unwrap: async () => ({}) });
        mock.create.mockReturnValue({ unwrap: async () => ({ uid: 42 }) });
    });
    it('sends only message and concurrency metadata, never identity/context', async () => {
        render(<HelpdeskChat threadUid={7} active onThreadCreated={vi.fn()} />);
        fireEvent.change(screen.getByLabelText('helpdeskChat.message'), { target: { value: 'Incoming calls fail' } });
        fireEvent.click(screen.getByText('helpdeskChat.send'));
        await waitFor(() => expect(mock.send).toHaveBeenCalledOnce());
        expect(Object.keys(mock.send.mock.calls[0][0]).sort()).toEqual(['expectedTaskId', 'expectedVersion', 'message', 'requestId', 'threadUid']);
        expect(mock.send.mock.calls[0][0]).toMatchObject({ threadUid: 7, message: 'Incoming calls fail', expectedTaskId: null, expectedVersion: null });
    });
    it('retries an uncertain send with the same UUID and preserved text', async () => {
        mock.send.mockReturnValueOnce({ unwrap: async () => { throw { status: 503 }; } });
        render(<HelpdeskChat threadUid={7} active onThreadCreated={vi.fn()} />);
        fireEvent.change(screen.getByLabelText('helpdeskChat.message'), { target: { value: 'Problem' } });
        fireEvent.click(screen.getByText('helpdeskChat.send'));
        await screen.findByText('helpdeskChat.retry');
        fireEvent.click(screen.getByText('helpdeskChat.retry'));
        await waitFor(() => expect(mock.send).toHaveBeenCalledTimes(2));
        expect(mock.send.mock.calls[1][0]).toEqual(mock.send.mock.calls[0][0]);
    });
    it('restores a clarification and passes the latest task version', async () => {
        mock.session.currentData = { task: { task_id: 'task-id', ticket_id: 55, version: 4, status: 'needs_input', result: {} }, history: [{ id: 'q', role: 'support', text: '<script>Which call?</script>' }] };
        render(<HelpdeskChat threadUid={7} active onThreadCreated={vi.fn()} />);
        expect(screen.getByText('<script>Which call?</script>')).toBeTruthy();
        expect(document.querySelector('script')).toBeNull();
        fireEvent.change(screen.getByLabelText('helpdeskChat.message'), { target: { value: 'External' } });
        fireEvent.click(screen.getByText('helpdeskChat.send'));
        await waitFor(() => expect(mock.send).toHaveBeenCalledOnce());
        expect(mock.send.mock.calls[0][0]).toMatchObject({ expectedTaskId: 'task-id', expectedVersion: 4 });
    });
    it('skips polling while hidden and disables send while processing', () => {
        mock.session.currentData.task = { status: 'running', ticket_id: 55, result: {} };
        render(<HelpdeskChat threadUid={7} active={false} onThreadCreated={vi.fn()} />);
        expect(mock.query).toHaveBeenCalledWith(7, expect.objectContaining({ skip: true }));
        expect(screen.getByLabelText('helpdeskChat.message')).toBeDisabled();
    });
    it('creates an owned local thread after explicit support entry', async () => {
        const created = vi.fn();
        render(<HelpdeskChat threadUid={null} active onThreadCreated={created} />);
        await waitFor(() => expect(created).toHaveBeenCalledWith(42));
        expect(mock.create).toHaveBeenCalledOnce();
    });
});
