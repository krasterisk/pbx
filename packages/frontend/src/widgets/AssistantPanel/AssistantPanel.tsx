import { useEffect, useRef, useCallback, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, X, Send, Trash2, RotateCcw, ArrowDown, ArrowLeft, Maximize2, Minimize2, ClipboardList } from 'lucide-react';
import { Button, Text, Textarea } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { aiChatActions } from '@/features/ai-chat/model/slice/aiChatSlice';
import { looksLikeUserConfirm } from '@krasterisk/shared';
import {
    useGetAiChatThreadQuery,
    useGetPendingAiChatWorkflowsQuery,
    useConfirmAiChatProposalMutation,
    useConfirmAiChatWorkflowMutation,
} from '@/shared/api/endpoints/aiChatApi';
import { TimelineList, isPendingConfirmCard, resolveLiveConfirmCard } from '@/features/ai-chat/ui/Timeline';
import { ThreadList } from '@/features/ai-chat/ui/ThreadList';
import { PlanRail } from '@/features/ai-chat/ui/PlanRail';
import { useAgentTurn } from '@/features/ai-chat/model/useAgentTurn';
import { useAssistantPanelLayout, type AssistantPanelResizeEdge } from '@/features/ai-chat/model/useAssistantPanelLayout';
import cls from './AssistantPanel.module.scss';

export type AssistantPanelMode = 'dock' | 'workspace';

const SELECTED_THREAD_KEY = 'assistant-selected-thread';
const COMPOSER_MAX_HEIGHT_PX = 168;

function syncComposerHeight(node: HTMLTextAreaElement): void {
    node.style.height = 'auto';
    node.style.height = `${Math.min(node.scrollHeight, COMPOSER_MAX_HEIGHT_PX)}px`;
    node.style.overflowY = node.scrollHeight > COMPOSER_MAX_HEIGHT_PX ? 'auto' : 'hidden';
}

function readStoredThreadUid(): number | null {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(SELECTED_THREAD_KEY);
    const uid = raw ? Number(raw) : NaN;
    return Number.isInteger(uid) && uid > 0 ? uid : null;
}

function writeStoredThreadUid(uid: number | null): void {
    if (typeof sessionStorage === 'undefined') return;
    if (uid == null) sessionStorage.removeItem(SELECTED_THREAD_KEY);
    else sessionStorage.setItem(SELECTED_THREAD_KEY, String(uid));
}

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
    const canPinPlanRail = !isDock;
    const sheet = isBelowTablet;
    const { cssVars, startResize, nudge } = useAssistantPanelLayout(sheet);

    const onResizeKey = (edge: AssistantPanelResizeEdge) => (event: KeyboardEvent) => {
        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            nudge(edge, edge === 'rail' ? -16 : 16);
        }
        if (event.key === 'ArrowRight') {
            event.preventDefault();
            nudge(edge, edge === 'rail' ? 16 : -16);
        }
    };
    const [selectedThreadUid, setSelectedThreadUid] = useState<number | null>(readStoredThreadUid);
    const [selectedReadOnly, setSelectedReadOnly] = useState(false);
    const [plansOpen, setPlansOpen] = useState(!isDock);
    const showPlanRail = canPinPlanRail && plansOpen;
    const [focusWorkflowId, setFocusWorkflowId] = useState<string | null>(null);

    const selectThread = useCallback((uid: number | null, readOnly = false) => {
        setSelectedThreadUid(uid);
        setSelectedReadOnly(readOnly);
        writeStoredThreadUid(uid);
    }, []);
    const { currentData: detail } = useGetAiChatThreadQuery(selectedThreadUid ?? 0, {
        skip: selectedThreadUid == null,
    });
    const { data: pendingWorkflows } = useGetPendingAiChatWorkflowsQuery(undefined, {
        skip: !open,
    });
    const pendingPlanCount = pendingWorkflows?.length ?? 0;

    const [lastError, setLastError] = useState<string | null>(null);
    const [confirmProposal] = useConfirmAiChatProposalMutation();
    const [confirmWorkflow] = useConfirmAiChatWorkflowMutation();
    const { send, continueAfterApply, stop, abort, retry, isStreaming, outcome } = useAgentTurn({
        threadUid: selectedThreadUid,
        onThreadCreated: (uid) => {
            selectThread(uid, false);
        },
    });
    const readOnly = selectedReadOnly || detail?.readOnly === true;

    const timeline = selectedThreadUid == null ? [] : (detail?.timeline ?? []);
    const cards = selectedThreadUid == null ? {} : (detail?.cards ?? {});
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

    const handleSelectThread = useCallback((selection: { uid: number; readOnly: boolean }) => {
        selectThread(selection.uid, selection.readOnly);
        dispatch(aiChatActions.resetTurn());
        setLastError(null);
    }, [dispatch, selectThread]);

    const handleFocusPlan = useCallback((workflowId: string) => {
        const plan = pendingWorkflows?.find((row) => row.workflowId === workflowId);
        if (!plan || plan.threadUid <= 0) return;
        selectThread(plan.threadUid, false);
        dispatch(aiChatActions.resetTurn());
        setLastError(null);
        if (isDock) setPlansOpen(false);
        setFocusWorkflowId(workflowId);
    }, [dispatch, isDock, pendingWorkflows, selectThread]);

    const handleDeletedThread = useCallback((uid: number) => {
        if (selectedThreadUid === uid) {
            selectThread(null);
            dispatch(aiChatActions.resetTurn());
            setLastError(null);
        }
    }, [dispatch, selectThread, selectedThreadUid]);

    const handleClearChat = useCallback(() => {
        abort();
        selectThread(null);
        dispatch(aiChatActions.resetTurn());
        setLastError(null);
    }, [abort, dispatch, selectThread]);

    useEffect(() => {
        if (!following) return;
        messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
    }, [detail?.timeline, outcome, following]);

    useEffect(() => {
        if (!open) return;
        const panel = panelRef.current;
        if (!panel) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            if (isDock && plansOpen) {
                setPlansOpen(false);
                return;
            }
            if (isDock) {
                onClose();
            } else {
                onModeChange('dock');
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open, isDock, onClose, onModeChange, plansOpen]);

    useEffect(() => {
        setPlansOpen(!isDock);
    }, [isDock]);

    useEffect(() => {
        if (!open) abort();
    }, [open, abort]);

    const applyPendingCard = useCallback((): boolean => {
        if (readOnly) return false;
        const live = resolveLiveConfirmCard(timeline, cards);
        const pending = live?.card
            ?? Object.values(cards).reverse().find((card) => isPendingConfirmCard(card))
            ?? null;
        if (!pending) return false;
        const apply = pending.card === 'workflow'
            ? confirmWorkflow(pending.workflow.workflowId).unwrap()
            : confirmProposal(pending.proposal.proposalId).unwrap();
        void apply.then(() => continueAfterApply()).catch((err: unknown) => {
            const message = err && typeof err === 'object' && 'message' in err
                ? String((err as { message?: unknown }).message ?? '')
                : '';
            setLastError(message || 'confirm failed');
        });
        return true;
    }, [cards, confirmProposal, confirmWorkflow, continueAfterApply, readOnly, timeline]);

    const handleSend = useCallback((overrideText?: string) => {
        const textarea = textareaRef.current;
        const text = overrideText ?? textarea?.value.trim();
        if (!text || isStreaming) return;

        if (textarea && !overrideText) {
            textarea.value = '';
            syncComposerHeight(textarea);
        }
        setLastError(null);

        if (looksLikeUserConfirm(text) && applyPendingCard()) {
            return;
        }
        send(text);
    }, [applyPendingCard, isStreaming, send]);

    const handleRetry = useCallback(() => {
        if (isStreaming) return;
        retry();
    }, [retry, isStreaming]);

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <>
            <Flex
                ref={panelRef}
                direction="column"
                align="stretch"
                role="dialog"
                aria-label={t('aiChat.title')}
                data-testid="ai-agent-panel"
                data-open={open ? 'true' : 'false'}
                data-mode={effectiveMode}
                data-sheet={isBelowTablet ? 'true' : 'false'}
                data-surface="agent"
                className={`${cls.panel} ${isDock ? cls.panelDock : cls.panelWorkspace} ${open ? cls.panelOpen : ''}`}
                style={cssVars as CSSProperties}
            >
                {!sheet && isDock && (
                    <Flex
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={t('aiChat.resizePanel')}
                        tabIndex={0}
                        data-testid="ai-agent-resize-dock"
                        className={`${cls.resizeHandle} ${cls.resizeDock}`}
                        onPointerDown={(event) => {
                            event.preventDefault();
                            startResize('dock', event.clientX);
                        }}
                        onKeyDown={onResizeKey('dock')}
                    >
                        {null}
                    </Flex>
                )}
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
                        <Text
                            as="span"
                            className={`${cls.headerStatus} ${isStreaming ? cls.headerStatusBusy : ''}`}
                            data-testid="ai-agent-header-status"
                        >
                            {isStreaming ? t('aiChat.progress.working') : t('aiChat.ready')}
                        </Text>
                    </VStack>

                    <Button
                        variant="ghost"
                        size="icon"
                        className={`${cls.planToggle} ${plansOpen ? cls.planToggleActive : ''}`}
                        onClick={() => setPlansOpen((visible) => !visible)}
                        title={plansOpen
                            ? (isDock ? t('aiChat.backToChat') : t('aiChat.hidePlans'))
                            : t('aiChat.openPlans')}
                        aria-label={t('aiChat.openPlans')}
                        aria-expanded={plansOpen}
                        aria-pressed={plansOpen}
                        aria-controls={isDock ? 'ai-agent-plan-overlay' : 'ai-agent-plan-column'}
                        data-active={plansOpen ? 'true' : 'false'}
                    >
                        <ClipboardList size={16} aria-hidden />
                        {pendingPlanCount > 0 && (
                            <Text as="span" className={cls.planBadge}>{pendingPlanCount}</Text>
                        )}
                    </Button>

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
                            {!sheet && (
                                <Flex
                                    role="separator"
                                    aria-orientation="vertical"
                                    aria-label={t('aiChat.resizeRail')}
                                    tabIndex={0}
                                    data-testid="ai-agent-resize-rail"
                                    className={`${cls.resizeHandle} ${cls.resizeRail}`}
                                    onPointerDown={(event) => startResize('rail', event.clientX)}
                                    onKeyDown={onResizeKey('rail')}
                                >
                                    {null}
                                </Flex>
                            )}
                        </VStack>
                    )}

                    <VStack
                        className={cls.conversation}
                        align="stretch"
                        data-testid="ai-agent-conversation"
                    >
                        {showWelcome && !readOnly && (
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
                                readOnly={readOnly}
                                working={isStreaming}
                                focusWorkflowId={focusWorkflowId}
                                onCardSettled={(status) => {
                                    if (!isStreaming && status === 'applied') continueAfterApply();
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
                            {outcome === 'timeout' && (
                                <HStack className={cls.outcomeRow} gap="8" align="center">
                                    <Text as="p" className={cls.outcome} data-testid="ai-agent-outcome">
                                        {t('aiChat.timeout')}
                                    </Text>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        className={cls.retryBtn}
                                        onClick={handleRetry}
                                        aria-label={t('aiChat.retry')}
                                    >
                                        {t('aiChat.retry')}
                                    </Button>
                                </HStack>
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
                            id="ai-agent-plan-column"
                            className={cls.planRail}
                            gap="8"
                            align="stretch"
                            aria-label={t('aiChat.plansHeading')}
                        >
                            {!sheet && (
                                <Flex
                                    role="separator"
                                    aria-orientation="vertical"
                                    aria-label={t('aiChat.resizePlan')}
                                    tabIndex={0}
                                    data-testid="ai-agent-resize-plan"
                                    className={`${cls.resizeHandle} ${cls.resizePlan}`}
                                    onPointerDown={(event) => startResize('plan', event.clientX)}
                                    onKeyDown={onResizeKey('plan')}
                                >
                                    {null}
                                </Flex>
                            )}
                            <PlanRail workflows={pendingWorkflows ?? []} onFocusWorkflow={handleFocusPlan} />
                        </VStack>
                    )}
                </HStack>

                {isDock && plansOpen && (
                    <VStack
                        id="ai-agent-plan-overlay"
                        className={cls.planOverlay}
                        gap="8"
                        align="stretch"
                        role="dialog"
                        aria-label={t('aiChat.plansHeading')}
                    >
                        <HStack className={cls.planOverlayBar} align="center" justify="between">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setPlansOpen(false)}
                                aria-label={t('aiChat.backToChat')}
                            >
                                <ArrowLeft size={14} aria-hidden />
                                {t('aiChat.backToChat')}
                            </Button>
                        </HStack>
                        <PlanRail workflows={pendingWorkflows ?? []} onFocusWorkflow={handleFocusPlan} />
                    </VStack>
                )}

                {readOnly ? (
                    <VStack className={cls.composer} gap="8" align="stretch">
                        <Text as="p">{t('aiChat.timeline.readOnlyHint')}</Text>
                    </VStack>
                ) : (
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
                    <Flex className={cls.inputShell} align="stretch" data-testid="ai-agent-input-shell">
                        <Textarea
                            ref={textareaRef}
                            id="ai-chat-input"
                            className={cls.composerInput}
                            placeholder={t('aiChat.inputPlaceholder')}
                            rows={1}
                            onInput={(event) => syncComposerHeight(event.currentTarget)}
                            onKeyDown={handleKeyDown}
                            disabled={isStreaming}
                        />
                        <Button
                            id="ai-chat-send"
                            className={cls.sendBtn}
                            variant={isStreaming ? 'ghost' : 'default'}
                            size="icon"
                            onClick={isStreaming ? stop : () => handleSend()}
                            title={isStreaming ? t('aiChat.stop') : t('aiChat.send')}
                            aria-label={isStreaming ? t('aiChat.stop') : t('aiChat.send')}
                        >
                            {isStreaming ? <X size={16} /> : <Send size={16} />}
                        </Button>
                    </Flex>
                </VStack>
                )}

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
