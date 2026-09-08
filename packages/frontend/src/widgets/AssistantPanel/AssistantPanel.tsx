import { useEffect, useRef, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, X, Send, Trash2, RotateCcw, ArrowDown, Maximize2, Minimize2 } from 'lucide-react';
import { Button, Text, Textarea } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { aiChatActions } from '@/features/ai-chat/model/slice/aiChatSlice';
import { useGetAiChatThreadQuery, useGetPendingAiChatWorkflowsQuery } from '@/shared/api/endpoints/aiChatApi';
import { TimelineList } from '@/features/ai-chat/ui/Timeline';
import { ThreadList } from '@/features/ai-chat/ui/ThreadList';
import { PlanRail } from '@/features/ai-chat/ui/PlanRail';
import { useAgentTurn } from '@/features/ai-chat/model/useAgentTurn';
import cls from './AssistantPanel.module.scss';

export type AssistantPanelMode = 'dock' | 'workspace';

function useNarrowViewport(): boolean {
    const [narrow, setNarrow] = useState(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return false;
        }
        return window.matchMedia('(max-width: 640px)').matches;
    });

    useEffect(() => {
        if (typeof window.matchMedia !== 'function') return;
        const mq = window.matchMedia('(max-width: 640px)');
        const onChange = () => setNarrow(mq.matches);
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);

    return narrow;
}

const SUGGESTION_KEYS = [
    'aiChat.suggestions.config',
    'aiChat.suggestions.createEndpoints',
    'aiChat.suggestions.addTrunk',
    'aiChat.suggestions.setupIvr',
] as const;

const FOCUSABLE_SELECTOR =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(root: HTMLElement): HTMLElement[] {
    return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1,
    );
}

export interface AssistantPanelProps {
    open: boolean;
    mode: AssistantPanelMode;
    onModeChange: (mode: AssistantPanelMode) => void;
    onClose: () => void;
}

export const AssistantPanel = ({ open, mode, onModeChange, onClose }: AssistantPanelProps) => {
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const isNarrow = useNarrowViewport();
    const effectiveMode: AssistantPanelMode = isNarrow ? 'dock' : mode;
    const isDock = effectiveMode === 'dock';
    const isBelowTablet = useIsMobile(768);
    const isBelowWide = useIsMobile(1024);
    const showRail = !isBelowWide;
    const showPlanRail = !isDock;
    const [selectedThreadUid, setSelectedThreadUid] = useState<number | null>(null);
    const { data: detail } = useGetAiChatThreadQuery(selectedThreadUid ?? 0, {
        skip: selectedThreadUid == null,
    });
    const { data: pendingWorkflows } = useGetPendingAiChatWorkflowsQuery(undefined, {
        skip: !showPlanRail,
    });

    const [lastError, setLastError] = useState<string | null>(null);
    const { send, continueAfterApply, stop, abort, retry, isStreaming, outcome } = useAgentTurn({
        threadUid: selectedThreadUid,
        onThreadCreated: setSelectedThreadUid,
    });

    const timeline = detail?.timeline ?? [];
    const cards = detail?.cards ?? {};
    const showWelcome = timeline.length === 0;

    const panelRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
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
        dispatch(aiChatActions.resetTurn());
        setLastError(null);
    }, [dispatch]);

    const handleDeletedThread = useCallback((uid: number) => {
        if (selectedThreadUid === uid) {
            setSelectedThreadUid(null);
            dispatch(aiChatActions.resetTurn());
            setLastError(null);
        }
    }, [dispatch, selectedThreadUid]);

    const handleClearChat = useCallback(() => {
        abort();
        setSelectedThreadUid(null);
        dispatch(aiChatActions.resetTurn());
        setLastError(null);
    }, [abort, dispatch]);

    useEffect(() => {
        if (!following) return;
        messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
    }, [detail?.timeline, outcome, following]);

    useEffect(() => {
        if (!open) return;
        const panel = panelRef.current;
        if (!panel) return;

        if (isDock) {
            const focusable = getFocusable(panel);
            focusable[0]?.focus();
        }

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                if (isDock) {
                    onClose();
                } else {
                    onModeChange('dock');
                }
                return;
            }
            if (!isDock || event.key !== 'Tab') return;
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
    }, [open, isDock, onClose, onModeChange]);

    useEffect(() => {
        if (!open) abort();
    }, [open, abort]);

    const handleSend = useCallback((overrideText?: string) => {
        const textarea = textareaRef.current;
        const text = overrideText ?? textarea?.value.trim();
        if (!text || isStreaming) return;

        if (textarea && !overrideText) textarea.value = '';
        setLastError(null);
        send(text);
    }, [send, isStreaming]);

    const handleRetry = useCallback(() => {
        if (isStreaming) return;
        retry();
    }, [retry, isStreaming]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <>
            {isDock && (
                <VStack
                    className={`${cls.overlay} ${open ? cls.overlayVisible : ''}`}
                    onClick={onClose}
                    aria-hidden
                >
                    {null}
                </VStack>
            )}

            <Flex
                ref={panelRef}
                direction="column"
                align="stretch"
                role="dialog"
                aria-label={t('aiChat.title')}
                aria-modal={isDock && open ? true : undefined}
                data-testid="ai-agent-panel"
                data-open={open ? 'true' : 'false'}
                data-mode={effectiveMode}
                data-sheet={isBelowTablet ? 'true' : 'false'}
                className={`${cls.panel} ${isDock ? cls.panelDock : cls.panelWorkspace} ${open ? cls.panelOpen : ''}`}
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
                        onClick={handleClearChat}
                        title={t('aiChat.clearChat')}
                        aria-label={t('aiChat.clearChat')}
                    >
                        <Trash2 size={14} />
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onModeChange(effectiveMode === 'workspace' ? 'dock' : 'workspace')}
                        title={effectiveMode === 'workspace' ? t('aiChat.collapse') : t('aiChat.expand')}
                        aria-label={effectiveMode === 'workspace' ? t('aiChat.collapse') : t('aiChat.expand')}
                    >
                        {effectiveMode === 'workspace' ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
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
                    className={`${cls.body} ${showRail ? cls.bodyWithRail : ''} ${showPlanRail ? cls.bodyWithPlan : ''}`}
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
                        {showWelcome && (
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
                            {showWelcome && (
                                <Text as="p">{t('aiChat.welcome')}</Text>
                            )}
                            <TimelineList
                                items={timeline}
                                cards={cards}
                                onCardSettled={() => {
                                    if (!isStreaming) continueAfterApply();
                                }}
                            />
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

                    {showPlanRail && (
                        <VStack
                            className={cls.planRail}
                            gap="8"
                            align="stretch"
                            aria-label={t('aiChat.plansHeading')}
                        >
                            <PlanRail workflows={pendingWorkflows ?? []} />
                        </VStack>
                    )}
                </HStack>

                <VStack
                    className={cls.composer}
                    gap="8"
                    align="stretch"
                    data-testid="ai-agent-composer"
                >
                    {lastError && !isStreaming && (
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
                            disabled={isStreaming}
                        />
                        <Button
                            id="ai-chat-send"
                            variant={isStreaming ? 'ghost' : 'default'}
                            size="icon"
                            onClick={isStreaming ? stop : () => handleSend()}
                            title={isStreaming ? t('aiChat.stop') : t('aiChat.send')}
                            aria-label={isStreaming ? t('aiChat.stop') : t('aiChat.send')}
                        >
                            {isStreaming ? <X size={16} /> : <Send size={16} />}
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
