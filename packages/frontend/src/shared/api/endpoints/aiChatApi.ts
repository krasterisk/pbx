import { rtkApi } from '../rtkApi';
import type { AiModel } from '@/features/ai-chat/model/types/AiChatSchema';

export interface IAiChatSettings {
    confirmDestructive: boolean;
}

export type AiChatThreadStatus = 'active' | 'archived';
export type AiChatThreadMessageRole = 'user' | 'assistant' | 'tool' | 'system';

/** Conversation row returned by GET /ai-chat/threads (15-03 persistence). */
export interface IAiChatThread {
    uid: number;
    title: string;
    status: AiChatThreadStatus;
    last_message_at: string | null;
    created_at: string;
    updated_at: string;
}

/** Stored message from GET /ai-chat/threads/:uid. */
export interface IAiChatThreadMessage {
    uid: number;
    thread_uid: number;
    role: AiChatThreadMessageRole;
    content: string | null;
    tool_name?: string | null;
    tool_calls?: unknown;
    proposal_id?: string | null;
    created_at: string;
}

export interface IAiChatThreadDetail extends IAiChatThread {
    messages: IAiChatThreadMessage[];
}

const aiChatApi = rtkApi.injectEndpoints({
    endpoints: (builder) => ({
        getAiChatModels: builder.query<AiModel[], void>({
            query: () => '/ai-chat/models',
        }),
        getAiChatState: builder.query<Record<string, any>, void>({
            query: () => '/ai-chat/state',
        }),
        // Per-tenant AI confirmation settings (D-20, D-25)
        getAiChatSettings: builder.query<IAiChatSettings, void>({
            query: () => '/ai-chat/settings',
            providesTags: ['AiChatSettings'],
        }),
        updateAiChatSettings: builder.mutation<IAiChatSettings, Partial<IAiChatSettings>>({
            query: (body) => ({
                url: '/ai-chat/settings',
                method: 'PUT',
                body,
            }),
            invalidatesTags: ['AiChatSettings'],
        }),
        getAiChatThreads: builder.query<IAiChatThread[], void>({
            query: () => '/ai-chat/threads',
            providesTags: (result) =>
                result
                    ? [
                          ...result.map((thread) => ({ type: 'AiChatThreads' as const, id: thread.uid })),
                          { type: 'AiChatThreads' as const, id: 'LIST' },
                      ]
                    : [{ type: 'AiChatThreads' as const, id: 'LIST' }],
        }),
        getAiChatThread: builder.query<IAiChatThreadDetail, number>({
            query: (uid) => `/ai-chat/threads/${uid}`,
            providesTags: (_result, _err, uid) => [{ type: 'AiChatThreads', id: uid }],
        }),
        createAiChatThread: builder.mutation<IAiChatThread, void>({
            query: () => ({
                url: '/ai-chat/threads',
                method: 'POST',
            }),
            invalidatesTags: [{ type: 'AiChatThreads', id: 'LIST' }],
        }),
        deleteAiChatThread: builder.mutation<void, number>({
            query: (uid) => ({
                url: `/ai-chat/threads/${uid}`,
                method: 'DELETE',
            }),
            invalidatesTags: (_result, _err, uid) => [
                { type: 'AiChatThreads', id: uid },
                { type: 'AiChatThreads', id: 'LIST' },
            ],
        }),
    }),
});

export { aiChatApi };

export const {
    useGetAiChatModelsQuery,
    useGetAiChatStateQuery,
    useGetAiChatSettingsQuery,
    useUpdateAiChatSettingsMutation,
    useGetAiChatThreadsQuery,
    useGetAiChatThreadQuery,
    useCreateAiChatThreadMutation,
    useDeleteAiChatThreadMutation,
} = aiChatApi;

/**
 * Stream AI chat message via SSE.
 * Returns AbortController so the caller can cancel.
 */
export function streamAiChatMessage(params: {
    message: string;
    history: Array<{ role: string; content: string }>;
    onText: (chunk: string) => void;
    onToolCall: (data: { name: string; arguments: string }) => void;
    onToolResult: (data: { name: string; result: string }) => void;
    onDone: () => void;
    onError: (msg: string) => void;
}): AbortController {
    const ac = new AbortController();
    const token = localStorage.getItem('accessToken');
    const apiBase = import.meta.env.VITE_API_URL || '/api';

    (async () => {
        try {
            const response = await fetch(`${apiBase}/ai-chat/message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ message: params.message, history: params.history }),
                signal: ac.signal,
            });

            if (!response.ok || !response.body) {
                params.onError(`HTTP ${response.status}`);
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                // Parse SSE lines
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';

                let eventType = '';
                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        eventType = line.slice(7).trim();
                    } else if (line.startsWith('data: ')) {
                        const raw = line.slice(6).trim();
                        try {
                            const data = JSON.parse(raw);
                            if (eventType === 'text') params.onText(data);
                            else if (eventType === 'tool_call') params.onToolCall(data);
                            else if (eventType === 'tool_result') params.onToolResult(data);
                            else if (eventType === 'done') { params.onDone(); return; }
                            else if (eventType === 'error') { params.onError(data); return; }
                        } catch {
                            // ignore parse errors
                        }
                        eventType = '';
                    }
                }
            }
            params.onDone();
        } catch (err: any) {
            if (err?.name !== 'AbortError') {
                params.onError(err?.message ?? 'Stream error');
            }
        }
    })();

    return ac;
}
