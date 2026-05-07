import { useEffect, useRef, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, Sparkles, X, Send, Trash2, RotateCcw } from 'lucide-react';
import { Button, Select, Textarea } from '@/shared/ui';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import { aiChatActions } from '@/features/ai-chat/model/slice/aiChatSlice';
import {
    selectAiChatIsOpen,
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

export const AiChatWidget = () => {
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const isOpen = useAppSelector(selectAiChatIsOpen);
    const messages = useAppSelector(selectAiChatMessages);
    const isStreaming = useAppSelector(selectAiChatIsStreaming);
    const selectedModel = useAppSelector(selectAiChatSelectedModel);
    const availableModels = useAppSelector(selectAiChatAvailableModels);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const abortRef = useRef<AbortController | null>(null);
    const lastMessageRef = useRef<string>('');
    const [lastError, setLastError] = useState<string | null>(null);

    const { data: modelsData } = useGetAiChatModelsQuery(undefined, { skip: !isOpen });

    // Load models into store when fetched
    useEffect(() => {
        if (modelsData) {
            dispatch(aiChatActions.setModels(modelsData));
        }
    }, [modelsData, dispatch]);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = useCallback((overrideText?: string) => {
        const textarea = textareaRef.current;
        const text = overrideText ?? textarea?.value.trim();
        if (!text || isStreaming) return;

        if (textarea && !overrideText) textarea.value = '';
        lastMessageRef.current = text;
        setLastError(null);

        // Build history from existing messages
        const history = messages
            .filter(m => !m.isStreaming)
            .map(m => ({ role: m.role as string, content: m.content }));

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
        // Remove last user + assistant messages to retry cleanly
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

    const modelOptions = availableModels.map(m => ({
        value: m.name,
        label: m.displayName,
    }));

    return (
        <>
            {/* Overlay */}
            <div
                className={`${cls.overlay} ${isOpen ? cls.overlayVisible : ''}`}
                onClick={() => dispatch(aiChatActions.closeChat())}
            />

            {/* Trigger button — hidden when panel is open (Send button overlap) */}
            {!isOpen && (
                <button
                    id="ai-chat-trigger"
                    className={cls.triggerBtn}
                    onClick={() => dispatch(aiChatActions.toggleChat())}
                    title={t('aiChat.openAssistant')}
                >
                    <Sparkles size={22} />
                    <span className={cls.triggerPulse} />
                </button>
            )}

            {/* Chat panel */}
            <div
                role="dialog"
                aria-label={t('aiChat.title')}
                className={`${cls.panel} ${isOpen ? cls.panelOpen : ''}`}
            >
                {/* Header */}
                <div className={cls.header}>
                    <div className={cls.avatar}>
                        <Bot size={18} />
                    </div>
                    <div className={cls.headerInfo}>
                        <div className={cls.headerTitle}>{t('aiChat.title')}</div>
                        <div className={cls.headerStatus}>{t('aiChat.ready')}</div>
                    </div>

                    {modelOptions.length > 0 && (
                        <Select
                            value={selectedModel}
                            onChange={(e) => dispatch(aiChatActions.setSelectedModel(e.target.value))}
                            title={t('aiChat.selectModel')}
                            style={{ width: 'auto', minWidth: '120px', height: '32px', fontSize: '12px' }}
                        >
                            {modelOptions.map(m => (
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
                        onClick={() => dispatch(aiChatActions.closeChat())}
                        title={t('aiChat.close')}
                    >
                        <X size={16} />
                    </Button>
                </div>

                {/* Suggestions (shown when no messages) */}
                {messages.length === 0 && (
                    <div className={cls.suggestions}>
                        {SUGGESTIONS.map((s) => (
                            <button
                                key={s}
                                className={cls.suggestionChip}
                                onClick={() => {
                                    if (textareaRef.current) textareaRef.current.value = s;
                                    handleSend();
                                }}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                )}

                {/* Messages */}
                <div className={cls.messages}>
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
                    <div ref={messagesEndRef} />
                </div>

                {/* Input area */}
                <div className={cls.inputArea}>
                    {/* Error banner with retry */}
                    {lastError && !isStreaming && (
                        <div className={cls.errorBanner}>
                            <span className={cls.errorText}>⚠ {lastError.slice(0, 80)}</span>
                            <button className={cls.retryBtn} onClick={handleRetry} title={t('aiChat.retry')}>
                                <RotateCcw size={12} /> {t('aiChat.retry')}
                            </button>
                        </div>
                    )}
                    <div className={cls.inputRow}>
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
                    </div>
                    <p className={cls.disclaimer}>{t('aiChat.disclaimer')}</p>
                </div>
            </div>
        </>
    );
};
