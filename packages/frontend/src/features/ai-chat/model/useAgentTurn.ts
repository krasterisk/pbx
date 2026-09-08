import { useCallback, useRef } from 'react';
import { useStore } from 'react-redux';
import type { AgentTimelineItem } from '@krasterisk/shared';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import { aiChatApi, type IAiChatThreadDetail } from '@/shared/api/endpoints/aiChatApi';
import { aiChatActions, type AgentTurnOutcome } from './slice/aiChatSlice';
import { selectAiChatIsStreaming } from './selectors/aiChatSelectors';

export type { AgentTurnOutcome };

export interface UseAgentTurnOptions {
    threadUid: number | null;
    onThreadCreated?: (uid: number) => void;
}

export interface UseAgentTurnApi {
    send: (text: string) => void;
    /** Скрытое продолжение после Apply: POST /threads/:uid/continue, без сообщения в ленте. */
    continueAfterApply: () => void;
    stop: () => void;
    abort: () => void;
    retry: () => void;
    isStreaming: boolean;
    outcome: AgentTurnOutcome;
}

function emptyThreadDetail(uid: number, createdAt: string): IAiChatThreadDetail {
    return {
        uid,
        title: '',
        status: 'active',
        last_message_at: null,
        created_at: createdAt,
        updated_at: createdAt,
        timeline: [],
        cards: {},
    };
}

function isTimelineItem(value: unknown): value is AgentTimelineItem {
    return (
        !!value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        'kind' in value &&
        'id' in value &&
        typeof (value as { id: unknown }).id === 'string'
    );
}

function readErrorPayload(data: unknown): { message: string; code?: string } {
    if (typeof data === 'string') return { message: data };
    if (data && typeof data === 'object') {
        const row = data as { message?: unknown; code?: unknown };
        return {
            message: row.message != null ? String(row.message) : 'Stream error',
            code: row.code != null ? String(row.code) : undefined,
        };
    }
    return { message: 'Stream error' };
}

/** Парсер SSE, общий для message и continue. Экспортируется для тестов. */
export function streamAgentTurn(params: {
    url: string;
    body?: Record<string, unknown>;
    onThread: (uid: number) => void;
    onItem: (item: AgentTimelineItem) => void;
    onDone: () => void;
    onError: (message: string, code?: string) => void;
    onDisconnect: () => void;
}): AbortController {
    const ac = new AbortController();
    const token = localStorage.getItem('accessToken');

    (async () => {
        let reachedTerminal = false;
        try {
            const response = await fetch(params.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(params.body ?? {}),
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

                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';

                let eventType = '';
                for (const line of lines) {
                    if (ac.signal.aborted) return;
                    if (line.startsWith('event: ')) {
                        eventType = line.slice(7).trim();
                    } else if (line.startsWith('data: ')) {
                        const raw = line.slice(6).trim();
                        try {
                            const data = JSON.parse(raw);
                            if (eventType === 'thread') {
                                const uid = data && typeof data === 'object' && typeof (data as { uid?: unknown }).uid === 'number'
                                    ? (data as { uid: number }).uid
                                    : undefined;
                                if (uid != null) params.onThread(uid);
                            } else if (eventType === 'item' && isTimelineItem(data)) {
                                params.onItem(data);
                            } else if (eventType === 'done') {
                                reachedTerminal = true;
                                params.onDone();
                                return;
                            } else if (eventType === 'error') {
                                reachedTerminal = true;
                                const parsed = readErrorPayload(data);
                                params.onError(parsed.message, parsed.code);
                                return;
                            }
                        } catch {
                            // ignore parse errors
                        }
                        eventType = '';
                    }
                }
            }
            if (!reachedTerminal && !ac.signal.aborted) {
                params.onDisconnect();
            }
        } catch (err: unknown) {
            const name = err && typeof err === 'object' && 'name' in err ? String((err as { name: unknown }).name) : '';
            const message = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : '';
            if (name === 'AbortError' || ac.signal.aborted) return;
            if (name === 'TypeError' || /network|fetch/i.test(message)) {
                params.onDisconnect();
                return;
            }
            params.onError(message || 'Stream error');
        }
    })();

    return ac;
}

export function useAgentTurn(options: UseAgentTurnOptions): UseAgentTurnApi {
    const dispatch = useAppDispatch();
    const store = useStore();
    const isStreaming = useAppSelector(selectAiChatIsStreaming);
    const outcome = useAppSelector((state) => (state.aiChat.turnOutcome ?? 'idle') as AgentTurnOutcome);
    const abortRef = useRef<AbortController | null>(null);
    const stoppedRef = useRef(false);
    const lastMessageRef = useRef('');
    const threadUidRef = useRef<number | null>(options.threadUid);
    const onThreadCreatedRef = useRef(options.onThreadCreated);
    const timelineRef = useRef<Record<number, AgentTimelineItem[]>>({});
    const sawProposalRef = useRef(false);
    threadUidRef.current = options.threadUid;
    onThreadCreatedRef.current = options.onThreadCreated;

    const upsertItem = useCallback((item: AgentTimelineItem) => {
        const threadUid = threadUidRef.current;
        if (threadUid == null) return;
        const cached = aiChatApi.endpoints.getAiChatThread.select(threadUid)(store.getState()).data;
        const current = timelineRef.current[threadUid] ?? cached?.timeline ?? [];
        const next = [...current];
        const index = next.findIndex((row) => row.id === item.id);
        if (index >= 0) next[index] = item;
        else next.push(item);
        timelineRef.current[threadUid] = next;
        dispatch(
            aiChatApi.util.updateQueryData('getAiChatThread', threadUid, (draft) => {
                draft.timeline = next;
            }),
        );
        if (!cached) {
            dispatch(aiChatApi.util.upsertQueryData('getAiChatThread', threadUid, {
                ...emptyThreadDetail(threadUid, item.createdAt),
                timeline: next,
            }));
        }
    }, [dispatch, store]);

    const bindStream = useCallback((url: string, body: Record<string, unknown>) => {
        abortRef.current = streamAgentTurn({
            url,
            body,
            onThread: (uid) => {
                if (stoppedRef.current) return;
                threadUidRef.current = uid;
                onThreadCreatedRef.current?.(uid);
            },
            onItem: (item) => {
                if (stoppedRef.current) return;
                if (item.kind === 'proposal') sawProposalRef.current = true;
                upsertItem(item);
            },
            onDone: () => {
                if (stoppedRef.current) return;
                const uid = threadUidRef.current;
                dispatch(aiChatActions.finishStreaming());
                if (uid != null && sawProposalRef.current) {
                    dispatch(aiChatApi.util.invalidateTags([{ type: 'AiChatThreads', id: uid }]));
                }
            },
            onError: (_message, code) => {
                if (stoppedRef.current) return;
                if (code === 'cancelled') {
                    dispatch(aiChatActions.setTurnOutcome('stopped'));
                    dispatch(aiChatActions.finishStreaming());
                    return;
                }
                if (code === 'max_steps_exceeded') {
                    dispatch(aiChatActions.setTurnOutcome('ceiling'));
                    dispatch(aiChatActions.finishStreaming());
                    return;
                }
                dispatch(aiChatActions.setTurnOutcome('failed'));
                dispatch(aiChatActions.finishStreaming());
            },
            onDisconnect: () => {
                if (stoppedRef.current) return;
                dispatch(aiChatActions.setTurnOutcome('disconnected'));
                dispatch(aiChatActions.finishStreaming());
            },
        });
    }, [dispatch, upsertItem]);

    const send = useCallback((text: string) => {
        const message = text.trim();
        if (!message || isStreaming) return;

        lastMessageRef.current = message;
        stoppedRef.current = false;
        sawProposalRef.current = false;
        dispatch(aiChatActions.startTurn());

        const apiBase = import.meta.env.VITE_API_URL || '/api';
        bindStream(`${apiBase}/ai-chat/message`, {
            message,
            ...(threadUidRef.current != null ? { threadUid: threadUidRef.current } : {}),
        });
    }, [bindStream, dispatch, isStreaming]);

    const continueAfterApply = useCallback(() => {
        const uid = threadUidRef.current;
        if (uid == null || isStreaming) return;

        stoppedRef.current = false;
        sawProposalRef.current = false;
        dispatch(aiChatActions.startTurn());

        const apiBase = import.meta.env.VITE_API_URL || '/api';
        bindStream(`${apiBase}/ai-chat/threads/${uid}/continue`, {});
    }, [bindStream, dispatch, isStreaming]);

    const stop = useCallback(() => {
        stoppedRef.current = true;
        abortRef.current?.abort();
        abortRef.current = null;
        dispatch(aiChatActions.setTurnOutcome('stopped'));
        dispatch(aiChatActions.finishStreaming());
    }, [dispatch]);

    const abort = useCallback(() => {
        stoppedRef.current = true;
        abortRef.current?.abort();
        abortRef.current = null;
        if (isStreaming) {
            dispatch(aiChatActions.setTurnOutcome('stopped'));
            dispatch(aiChatActions.finishStreaming());
        }
    }, [dispatch, isStreaming]);

    const retry = useCallback(() => {
        if (!lastMessageRef.current || isStreaming) return;
        send(lastMessageRef.current);
    }, [isStreaming, send]);

    return {
        send,
        continueAfterApply,
        stop,
        abort,
        retry,
        isStreaming,
        outcome,
    };
}
