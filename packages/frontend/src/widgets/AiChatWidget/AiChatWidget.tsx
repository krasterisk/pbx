import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, X, Send, Trash2, RotateCcw, ArrowDown } from 'lucide-react';
import { Button, Text, Textarea } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { aiChatActions } from '@/features/ai-chat/model/slice/aiChatSlice';
import {
    selectAiChatMessages,
    selectAiChatIsStreaming,
} from '@/features/ai-chat/model/selectors/aiChatSelectors';
import {
    isProposalClientView,
    useGetAiChatThreadQuery,
    type IAgentProposalView,
    type IAiChatThreadMessage,
} from '@/shared/api/endpoints/aiChatApi';
import type { AiChatMessage } from '@/features/ai-chat/model/types/AiChatSchema';
import { ChatMessage } from '@/features/ai-chat/ui/ChatMessage/ChatMessage';
import { DiffConfirmCard } from '@/features/ai-chat/ui/DiffConfirmCard';
import { ThreadList } from '@/features/ai-chat/ui/ThreadList';
import { useAgentStream } from '@/features/ai-chat/model/useAgentStream';
import cls from './AiChatWidget.module.scss';

const SUGGESTION_KEYS = [
    'aiChat.suggestions.config',
    'aiChat.suggestions.createEndpoints',
    'aiChat.suggestions.addTrunk',
    'aiChat.suggestions.setupIvr',
] as const;

function toChatMessage(message: IAiChatThreadMessage): AiChatMessage {
    return {
        id: String(message.uid),
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: message.content ?? '',
        createdAt: new Date(message.created_at).getTime(),
        toolCalls: Array.isArray(message.tool_calls) ? message.tool_calls : undefined,
    };
}

function extractProposal(message: IAiChatThreadMessage): IAgentProposalView | undefined {
    if (isProposalClientView(message.proposal)) return message.proposal;
    if (isProposalClientView(message.tool_calls)) return message.tool_calls;
    if (Array.isArray(message.tool_calls)) {
        return message.tool_calls.find(isProposalClientView);
    }
    return undefined;
}

const FOCUSABLE_SELECTOR =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(root: HTMLElement): HTMLElement[] {
    return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1,
    );
}

export interface AiChatWidgetProps {
    open: boolean;
    onClose: () => void;
}

export const AiChatWidget = ({ open, onClose }: AiChatWidgetProps) => {
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const inFlightMessages = useAppSelector(selectAiChatMessages);
    const isStreaming = useAppSelector(selectAiChatIsStreaming);
    const isBelowTablet = useIsMobile(768);
    const isBelowWide = useIsMobile(1024);
    const showRail = !isBelowWide;
    const [selectedThreadUid, setSelectedThreadUid] = useState<number | null>(null);
    const { data: threadDetail } = useGetAiChatThreadQuery(selectedThreadUid ?? 0, {
        skip: selectedThreadUid == null,
    });

    const [lastError, setLastError] = useState<string | null>(null);
    const [streamProposal, setStreamProposal] = useState<IAgentProposalView | null>(null);
    const {
        send,
        stop,
        abort,
        retry,
        progressLines,
        isStreaming: turnStreaming,
        outcome,
        proposal: hookProposal,
    } = useAgentStream({
        threadUid: selectedThreadUid,
        onProposal: setStreamProposal,
    });
    const streaming = isStreaming || turnStreaming;
    const activeProposal = streamProposal ?? hookProposal;

    const committedItems = useMemo(
        () =>
            (threadDetail?.messages ?? [])
                .filter((message) => message.role === 'user' || message.role === 'assistant')
                .map((message) => ({
                    message: toChatMessage(message),
                    proposal: extractProposal(message),
                })),
        [threadDetail],
    );
    const items = [
        ...(selectedThreadUid == null ? [] : committedItems),
        ...inFlightMessages.map((message, index, list) => ({
            message,
            proposal:
                index === list.length - 1 && message.role === 'assistant'
                    ? activeProposal ?? undefined
                    : undefined,
        })),
    ];
    const messages = items.map((item) => item.message);

    const panelRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const lastMessageRef = useRef<string>('');
    const [following, setFollowing] = useState(true);

    const FOLLOW_TOLERANCE_PX = 48;

    const handleMessagesScroll = useCallback(() => {
        const node = messagesRef.current;
        if (!node) return;
        const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
        setFollowing(distance <= FOLLOW_TOLERANCE_PX);
    }, []);

    const jumpToLatest = useCallback(() => {
        setFollowing(true);
        messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
    }, []);

    const handleSelectThread = useCallback((uid: number) => {
        setSelectedThreadUid(uid);
        dispatch(aiChatActions.clearMessages());
        setLastError(null);
        setStreamProposal(null);
    }, [dispatch]);

    const handleDeletedThread = useCallback((uid: number) => {
        if (selectedThreadUid === uid) {
            setSelectedThreadUid(null);
            dispatch(aiChatActions.clearMessages());
            setLastError(null);
            setStreamProposal(null);
        }
    }, [dispatch, selectedThreadUid]);

    useEffect(() => {
        if (!following) return;
        messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
    }, [messages, progressLines, outcome, following]);

    useEffect(() => {
        if (!open) return;
        const panel = panelRef.current;
        if (!panel) return;

        const focusable = getFocusable(panel);
        focusable[0]?.focus();

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
                return;
            }
            if (event.key !== 'Tab') return;
            const items = getFocusable(panel);
            if (items.length === 0) return;
            const first = items[0];
            const last = items[items.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open, onClose]);

    useEffect(() => {
        if (!open) abort();
    }, [open, abort]);

    const handleSend = useCallback((overrideText?: string) => {
        const textarea = textareaRef.current;
        const text = overrideText ?? textarea?.value.trim();
        if (!text || streaming) return;

        if (textarea && !overrideText) textarea.value = '';
        lastMessageRef.current = text;
        setLastError(null);
        setStreamProposal(null);
        send(text);
    }, [send, streaming]);

    const handleRetry = useCallback(() => {
        if (streaming) return;
        retry();
    }, [retry, streaming]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <>
            <VStack
                className={`${cls.overlay} ${open ? cls.overlayVisible : ''}`}
                onClick={onClose}
                aria-hidden
            >
                {null}
            </VStack>

            <Flex
                ref={panelRef}
                direction="column"
                align="stretch"
                role="dialog"
                aria-label={t('aiChat.title')}
                aria-modal={open}
                data-testid="ai-agent-panel"
                data-open={open ? 'true' : 'false'}
                data-sheet={isBelowTablet ? 'true' : 'false'}
                className={`${cls.panel} ${open ? cls.panelOpen : ''}`}
            >
                <HStack
                    className={cls.header}
                    gap="8"
                    align="center"
                    data-testid="ai-agent-header"
                >
                    <VStack className={cls.avatar} align="center" justify="center">
                        <Bot size={18} aria-hidden />
                    </VStack>
                    <VStack className={cls.headerInfo} gap="0" align="start">
                        <Text as="span" className={cls.headerTitle}>{t('aiChat.title')}</Text>
                        <Text as="span" className={cls.headerStatus}>{t('aiChat.ready')}</Text>
                    </VStack>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => dispatch(aiChatActions.clearMessages())}
                        title={t('aiChat.clearChat')}
                    >
                        <Trash2 size={14} />
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        title={t('aiChat.closePanel')}
                        aria-label={t('aiChat.closePanel')}
                    >
                        <X size={16} />
                    </Button>
                </HStack>

                <HStack
                    className={`${cls.body} ${showRail ? cls.bodyWithRail : ''}`}
                    align="stretch"
                    data-testid="ai-agent-body"
                >
                    {showRail && (
                        <VStack
                            className={cls.rail}
                            gap="8"
                            align="stretch"
                            data-testid="ai-agent-thread-rail"
                            aria-label={t('aiChat.threadsHeading')}
                        >
                            <ThreadList
                                selectedUid={selectedThreadUid}
                                onSelect={handleSelectThread}
                                onDeleted={handleDeletedThread}
                            />
                        </VStack>
                    )}

                    <VStack
                        className={cls.conversation}
                        align="stretch"
                        data-testid="ai-agent-conversation"
                    >
                        {messages.length === 0 && (
                            <HStack className={cls.suggestions} gap="8" wrap="wrap">
                                {SUGGESTION_KEYS.map((key) => (
                                    <Button
                                        key={key}
                                        type="button"
                                        variant="ghost"
                                        className={cls.suggestionChip}
                                        onClick={() => {
                                            const label = t(key);
                                            if (textareaRef.current) textareaRef.current.value = label;
                                            handleSend(label);
                                        }}
                                    >
                                        {t(key)}
                                    </Button>
                                ))}
                            </HStack>
                        )}

                        <Flex
                            ref={messagesRef}
                            direction="column"
                            className={cls.messages}
                            gap="12"
                            align="stretch"
                            data-testid="ai-agent-messages"
                            onScroll={handleMessagesScroll}
                        >
                            {messages.length === 0 && (
                                <ChatMessage
                                    message={{
                                        id: 'welcome',
                                        role: 'assistant',
                                        content: t('aiChat.welcome'),
                                        createdAt: Date.now(),
                                    }}
                                />
                            )}
                            {items.map((item) => (
                                <VStack key={item.message.id} gap="8" align="stretch">
                                    {item.proposal && item.message.role === 'assistant' && item.message.isStreaming ? (
                                        <>
                                            <DiffConfirmCard proposal={item.proposal} />
                                            <ChatMessage message={item.message} />
                                        </>
                                    ) : (
                                        <>
                                            <ChatMessage message={item.message} />
                                            {item.proposal && (
                                                <DiffConfirmCard proposal={item.proposal} />
                                            )}
                                        </>
                                    )}
                                </VStack>
                            ))}
                            {progressLines.length > 0 && (
                                <VStack
                                    className={cls.progress}
                                    gap="4"
                                    align="stretch"
                                    data-testid="ai-agent-progress"
                                    aria-live="polite"
                                >
                                    {progressLines.map((line, index) => (
                                        <Text as="p" key={`${line}-${index}`} className={cls.progressLine}>
                                            {line}
                                        </Text>
                                    ))}
                                </VStack>
                            )}
                            {outcome === 'stopped' && (
                                <Text as="p" className={cls.outcome} data-testid="ai-agent-outcome">
                                    {t('aiChat.stopped')}
                                </Text>
                            )}
                            {outcome === 'ceiling' && (
                                <Text as="p" className={cls.outcome} data-testid="ai-agent-outcome">
                                    {t('aiChat.ceiling')}
                                </Text>
                            )}
                            {outcome === 'failed' && (
                                <Text as="p" className={cls.outcome} data-testid="ai-agent-outcome">
                                    {t('aiChat.failed')}
                                </Text>
                            )}
                            {outcome === 'disconnected' && (
                                <HStack className={cls.outcomeRow} gap="8" align="center">
                                    <Text as="p" className={cls.outcome} data-testid="ai-agent-outcome">
                                        {t('aiChat.disconnected')}
                                    </Text>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        className={cls.retryBtn}
                                        onClick={handleRetry}
                                        aria-label={t('aiChat.reconnect')}
                                    >
                                        {t('aiChat.reconnect')}
                                    </Button>
                                </HStack>
                            )}
                            <Flex ref={messagesEndRef} aria-hidden direction="column">{null}</Flex>
                        </Flex>
                        {!following && (
                            <Button
                                type="button"
                                variant="ghost"
                                className={cls.jumpLatest}
                                onClick={jumpToLatest}
                                aria-label={t('aiChat.jumpToLatest')}
                            >
                                <ArrowDown size={14} aria-hidden />
                                {t('aiChat.jumpToLatest')}
                            </Button>
                        )}
                    </VStack>
                </HStack>

                <VStack
                    className={cls.composer}
                    gap="8"
                    align="stretch"
                    data-testid="ai-agent-composer"
                >
                    {lastError && !streaming && (
                        <HStack className={cls.errorBanner} gap="8" align="center">
                            <Text as="span" className={cls.errorText}>{lastError.slice(0, 80)}</Text>
                            <Button
                                type="button"
                                variant="ghost"
                                className={cls.retryBtn}
                                onClick={handleRetry}
                                title={t('aiChat.retry')}
                            >
                                <RotateCcw size={12} /> {t('aiChat.retry')}
                            </Button>
                        </HStack>
                    )}
                    <HStack className={cls.inputRow} gap="8" align="end">
                        <Textarea
                            ref={textareaRef}
                            id="ai-chat-input"
                            placeholder={t('aiChat.inputPlaceholder')}
                            rows={1}
                            onKeyDown={handleKeyDown}
                            disabled={streaming}
                        />
                        <Button
                            id="ai-chat-send"
                            variant={streaming ? 'ghost' : 'default'}
                            size="icon"
                            onClick={streaming ? stop : () => handleSend()}
                            title={streaming ? t('aiChat.stop') : t('aiChat.send')}
                            aria-label={streaming ? t('aiChat.stop') : t('aiChat.send')}
                        >
                            {streaming ? <X size={16} /> : <Send size={16} />}
                        </Button>
                    </HStack>
                </VStack>

                <VStack
                    className={cls.footer}
                    align="center"
                    data-testid="ai-agent-footer"
                >
                    <Text as="p" className={cls.disclaimer}>{t('aiChat.disclaimer')}</Text>
                </VStack>
            </Flex>
        </>
    );
};
