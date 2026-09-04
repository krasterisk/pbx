import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import { streamAiChatMessage, type IAgentProposalView } from '@/shared/api/endpoints/aiChatApi';
import { aiChatActions, type AgentTurnOutcome } from './slice/aiChatSlice';
import { selectAiChatIsStreaming, selectAiChatMessages } from './selectors/aiChatSelectors';

const TOOL_PROGRESS_KEYS: Record<string, string> = {
    get_pbx_state: 'aiChat.progress.tools.get_pbx_state',
    read_skill: 'aiChat.progress.tools.read_skill',
    find_cdr_calls: 'aiChat.progress.tools.find_cdr_calls',
    evaluate_time_group: 'aiChat.progress.tools.evaluate_time_group',
    describe_number: 'aiChat.progress.tools.describe_number',
};

export function localizeProgressLine(tool: string | undefined, t: (key: string) => string): string {
    if (tool && TOOL_PROGRESS_KEYS[tool]) {
        return t(TOOL_PROGRESS_KEYS[tool]);
    }
    return t('aiChat.progress.working');
}

export interface UseAgentStreamOptions {
    threadUid?: number | null;
    onProposal?: (view: IAgentProposalView) => void;
}

export function useAgentStream(options: UseAgentStreamOptions = {}) {
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const messages = useAppSelector(selectAiChatMessages);
    const isStreaming = useAppSelector(selectAiChatIsStreaming);
    const progressLines = useAppSelector((state) => state.aiChat.progressLines ?? []);
    const outcome = useAppSelector((state) => (state.aiChat.turnOutcome ?? 'idle') as AgentTurnOutcome);
    const abortRef = useRef<AbortController | null>(null);
    const stoppedRef = useRef(false);
    const lastMessageRef = useRef('');

    const answerText = [...messages].reverse().find((message) => message.role === 'assistant')?.content ?? '';

    const ignoreAfterStop = useCallback(() => stoppedRef.current, []);

    const send = useCallback((message: string) => {
        const text = message.trim();
        if (!text || isStreaming) return;

        lastMessageRef.current = text;
        stoppedRef.current = false;

        const history = messages
            .filter((item) => !item.isStreaming)
            .map((item) => ({ role: item.role as string, content: item.content }));

        dispatch(aiChatActions.addUserMessage(text));
        dispatch(aiChatActions.startAssistantMessage());

        abortRef.current = streamAiChatMessage({
            message: text,
            history,
            threadUid: options.threadUid ?? undefined,
            onText: (chunk) => {
                if (ignoreAfterStop()) return;
                dispatch(aiChatActions.appendTextChunk(chunk));
            },
            onProgress: (data) => {
                if (ignoreAfterStop()) return;
                dispatch(aiChatActions.addProgressLine(localizeProgressLine(data?.tool, t)));
            },
            onProposal: (view) => {
                if (ignoreAfterStop()) return;
                options.onProposal?.(view);
            },
            onDone: () => {
                if (ignoreAfterStop()) return;
                dispatch(aiChatActions.finishStreaming());
            },
            onError: (msg, code) => {
                if (ignoreAfterStop()) return;
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
                dispatch(aiChatActions.appendTextChunk(`\n\n*${t('aiChat.error')}: ${msg}*`));
                dispatch(aiChatActions.setTurnOutcome('failed'));
                dispatch(aiChatActions.finishStreaming());
            },
            onDisconnect: () => {
                if (ignoreAfterStop()) return;
                dispatch(aiChatActions.setTurnOutcome('disconnected'));
                dispatch(aiChatActions.finishStreaming());
            },
        });
    }, [dispatch, ignoreAfterStop, isStreaming, messages, options, t]);

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
        dispatch(aiChatActions.removeLastAssistantMessage());
        send(lastMessageRef.current);
    }, [dispatch, isStreaming, send]);

    return {
        send,
        stop,
        abort,
        retry,
        lastMessage: lastMessageRef.current,
        progressLines,
        answerText,
        isStreaming,
        outcome,
    };
}
