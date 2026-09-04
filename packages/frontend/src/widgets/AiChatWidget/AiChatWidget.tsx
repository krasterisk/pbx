import { useEffect, useRef, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, X, Send, Trash2, RotateCcw } from 'lucide-react';
import { Button, Select, Text, Textarea } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import { aiChatActions } from '@/features/ai-chat/model/slice/aiChatSlice';
import {
    selectAiChatMessages,
    selectAiChatIsStreaming,
    selectAiChatSelectedModel,
    selectAiChatAvailableModels,
} from '@/features/ai-chat/model/selectors/aiChatSelectors';
import { useGetAiChatModelsQuery, streamAiChatMessage } from '@/shared/api/endpoints/aiChatApi';
import { ChatMessage } from '@/features/ai-chat/ui/ChatMessage/ChatMessage';
import cls from './AiChatWidget.module.scss';

const SUGGESTIONS = [
    'Показать конфигурацию АТС',
    'Создать 10 абонентов',
    'Добавить транк',
    'Настроить IVR меню',
];

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
    const messages = useAppSelector(selectAiChatMessages);
    const isStreaming = useAppSelector(selectAiChatIsStreaming);
    const selectedModel = useAppSelector(selectAiChatSelectedModel);
    const availableModels = useAppSelector(selectAiChatAvailableModels);

    const panelRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const abortRef = useRef<AbortController | null>(null);
    const lastMessageRef = useRef<string>('');
    const [lastError, setLastError] = useState<string | null>(null);

    const { data: modelsData } = useGetAiChatModelsQuery(undefined, { skip: !open });

    useEffect(() => {
        if (modelsData) {
            dispatch(aiChatActions.setModels(modelsData));
        }
    }, [modelsData, dispatch]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
    }, [messages]);

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

    const handleSend = useCallback((overrideText?: string) => {
        const textarea = textareaRef.current;
        const text = overrideText ?? textarea?.value.trim();
        if (!text || isStreaming) return;

        if (textarea && !overrideText) textarea.value = '';
        lastMessageRef.current = text;
        setLastError(null);

        const history = messages
            .filter((m) => !m.isStreaming)
            .map((m) => ({ role: m.role as string, content: m.content }));

        dispatch(aiChatActions.addUserMessage(text));
        dispatch(aiChatActions.startAssistantMessage());

        abortRef.current = streamAiChatMessage({
            message: text,
            history,
            onText: (chunk) => dispatch(aiChatActions.appendTextChunk(chunk)),
            onToolCall: (data) => dispatch(aiChatActions.addToolCall({ ...data })),
            onToolResult: (data) => dispatch(aiChatActions.updateToolResult(data)),
            onDone: () => dispatch(aiChatActions.finishStreaming()),
            onError: (msg) => {
                dispatch(aiChatActions.appendTextChunk(`\n\n*${t('aiChat.error')}: ${msg}*`));
                dispatch(aiChatActions.finishStreaming());
                setLastError(msg);
            },
        });
    }, [dispatch, isStreaming, messages, t]);

    const handleRetry = useCallback(() => {
        if (!lastMessageRef.current || isStreaming) return;
        dispatch(aiChatActions.removeLastAssistantMessage());
        handleSend(lastMessageRef.current);
    }, [dispatch, isStreaming, handleSend]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleStop = () => {
        abortRef.current?.abort();
        dispatch(aiChatActions.finishStreaming());
        setLastError(null);
    };

    const modelOptions = availableModels.map((m) => ({
        value: m.name,
        label: m.displayName,
    }));

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
                className={`${cls.panel} ${open ? cls.panelOpen : ''}`}
            >
                <HStack className={cls.header} gap="8" align="center">
                    <VStack className={cls.avatar} align="center" justify="center">
                        <Bot size={18} aria-hidden />
                    </VStack>
                    <VStack className={cls.headerInfo} gap="0" align="start">
                        <Text as="span" className={cls.headerTitle}>{t('aiChat.title')}</Text>
                        <Text as="span" className={cls.headerStatus}>{t('aiChat.ready')}</Text>
                    </VStack>

                    {modelOptions.length > 0 && (
                        <Select
                            value={selectedModel}
                            onChange={(e) => dispatch(aiChatActions.setSelectedModel(e.target.value))}
                            title={t('aiChat.selectModel')}
                            style={{ width: 'auto', minWidth: '120px', height: '32px', fontSize: '12px' }}
                        >
                            {modelOptions.map((m) => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                        </Select>
                    )}

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
                        title={t('aiChat.close')}
                        aria-label={t('aiChat.close')}
                    >
                        <X size={16} />
                    </Button>
                </HStack>

                {messages.length === 0 && (
                    <HStack className={cls.suggestions} gap="8" wrap="wrap">
                        {SUGGESTIONS.map((s) => (
                            <Button
                                key={s}
                                type="button"
                                variant="ghost"
                                className={cls.suggestionChip}
                                onClick={() => {
                                    if (textareaRef.current) textareaRef.current.value = s;
                                    handleSend();
                                }}
                            >
                                {s}
                            </Button>
                        ))}
                    </HStack>
                )}

                <VStack className={cls.messages} gap="12" align="stretch">
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
                    {messages.map((msg) => (
                        <ChatMessage key={msg.id} message={msg} />
                    ))}
                    <Flex ref={messagesEndRef} aria-hidden direction="column">{null}</Flex>
                </VStack>

                <VStack className={cls.inputArea} gap="8" align="stretch">
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
                            onClick={isStreaming ? handleStop : () => handleSend()}
                            title={isStreaming ? t('aiChat.stop') : t('aiChat.send')}
                        >
                            {isStreaming ? <X size={16} /> : <Send size={16} />}
                        </Button>
                    </HStack>
                    <Text as="p" className={cls.disclaimer}>{t('aiChat.disclaimer')}</Text>
                </VStack>
            </Flex>
        </>
    );
};
