import { useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    Wrench, CheckCircle, Loader, ChevronDown, ChevronUp,
    AlertCircle,
} from 'lucide-react';
import type { AiChatMessage } from '@/features/ai-chat/model/types/AiChatSchema';
import cls from './ChatMessage.module.scss';

interface ChatMessageProps {
    message: AiChatMessage;
}

function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

/** Парсим JSON результат инструмента и отображаем понятно */
function parseToolResult(raw: string): string {
    try {
        const obj = JSON.parse(raw);
        if (obj.created !== undefined) return `✅ Создано: ${obj.created}`;
        if (obj.success === true && obj.deleted !== undefined) return `✅ Удалено: ${obj.deleted}`;
        if (obj.id !== undefined && obj.name !== undefined) return `✅ ${obj.name} (ID: ${obj.id})`;
        if (obj.endpoints !== undefined) {
            const ep = obj.endpoints?.length ?? 0;
            const tr = obj.trunks?.length ?? 0;
            const iv = obj.ivrs?.length ?? 0;
            const qu = obj.queues?.length ?? 0;
            return `📊 Абоненты: ${ep}, Транки: ${tr}, IVR: ${iv}, Очереди: ${qu}`;
        }
        if (obj.linesApplied !== undefined) return `✅ Диалплан применён (${obj.linesApplied} строк)`;
        return raw.length > 160 ? raw.slice(0, 160) + '…' : raw;
    } catch {
        return raw.length > 160 ? raw.slice(0, 160) + '…' : raw;
    }
}

/** Форматируем аргументы tool call для показа */
function formatToolArgs(raw: string): string {
    try {
        const obj = JSON.parse(raw);
        return Object.entries(obj)
            .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
            .join(' · ');
    } catch {
        return raw;
    }
}

/** Заменяем имена инструментов на человекочитаемые */
const TOOL_LABELS: Record<string, string> = {
    get_pbx_state: 'Получение состояния АТС',
    create_endpoints_bulk: 'Массовое создание абонентов',
    create_endpoint: 'Создание абонента',
    delete_endpoint: 'Удаление абонента',
    create_trunk: 'Создание транка',
    delete_trunk: 'Удаление транка',
    create_ivr: 'Создание IVR-меню',
    update_ivr: 'Обновление IVR',
    delete_ivr: 'Удаление IVR',
    create_queue: 'Создание очереди',
    update_queue: 'Обновление очереди',
    delete_queue: 'Удаление очереди',
    create_route: 'Создание маршрута',
    delete_route: 'Удаление маршрута',
    apply_dialplan: 'Применение диалплана',
    list_contexts: 'Получение контекстов',
};

export const ChatMessage = ({ message }: ChatMessageProps) => {
    const { role, content, toolCalls, isStreaming, createdAt } = message;
    const [expandedTools, setExpandedTools] = useState<Set<number>>(new Set());

    const toggleTool = (idx: number) => {
        setExpandedTools(prev => {
            const next = new Set(prev);
            next.has(idx) ? next.delete(idx) : next.add(idx);
            return next;
        });
    };

    const isThinking = isStreaming && !content && !toolCalls?.length;

    return (
        <div className={`${cls.root} ${cls[role]}`}>
            {/* Thinking skeleton */}
            {isThinking && (
                <div className={cls.bubble}>
                    <div className={cls.thinkingDots}>
                        <span /><span /><span />
                    </div>
                </div>
            )}

            {/* Main bubble — Markdown */}
            {content && (
                <div className={cls.bubble}>
                    {role === 'assistant' ? (
                        <Markdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                // v10: receives all HTML element props + node
                                code({ children, className, ...rest }) {
                                    const isBlock = /language-/.test(className ?? '');
                                    return isBlock
                                        ? <pre className={cls.codeBlock}><code>{children}</code></pre>
                                        : <code className={cls.inlineCode} {...rest}>{children}</code>;
                                },
                                p({ children }) { return <p className={cls.mdParagraph}>{children}</p>; },
                                ul({ children }) { return <ul className={cls.mdList}>{children}</ul>; },
                                ol({ children }) { return <ol className={cls.mdList}>{children}</ol>; },
                                li({ children }) { return <li className={cls.mdListItem}>{children}</li>; },
                                strong({ children }) { return <strong className={cls.mdStrong}>{children}</strong>; },
                                h1({ children }) { return <h3 className={cls.mdHeading}>{children}</h3>; },
                                h2({ children }) { return <h3 className={cls.mdHeading}>{children}</h3>; },
                                h3({ children }) { return <h3 className={cls.mdHeading}>{children}</h3>; },
                            }}
                        >
                            {content}
                        </Markdown>
                    ) : (
                        content
                    )}
                    {isStreaming && !toolCalls?.length && (
                        <span className={cls.cursor} aria-hidden />
                    )}
                </div>
            )}

            {/* Tool calls — ExecutionPlan */}
            {toolCalls && toolCalls.length > 0 && (
                <div className={cls.executionPlan}>
                    <div className={cls.planHeader}>
                        <Wrench size={12} />
                        <span>План выполнения</span>
                        <span className={cls.planCount}>{toolCalls.filter(t => t.result).length}/{toolCalls.length}</span>
                    </div>
                    <div className={cls.planSteps}>
                        {toolCalls.map((tc, idx) => {
                            const isExpanded = expandedTools.has(idx);
                            const isDone = Boolean(tc.result);
                            const isActive = !isDone && isStreaming;
                            const label = TOOL_LABELS[tc.name] ?? tc.name;

                            return (
                                <div
                                    key={`${tc.name}_${idx}`}
                                    className={`${cls.planStep} ${isDone ? cls.stepDone : ''} ${isActive ? cls.stepActive : ''}`}
                                >
                                    <div
                                        className={cls.stepHeader}
                                        onClick={() => toggleTool(idx)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={e => e.key === 'Enter' && toggleTool(idx)}
                                    >
                                        {/* Step status icon */}
                                        <div className={cls.stepIcon}>
                                            {isDone
                                                ? <CheckCircle size={13} />
                                                : isActive
                                                    ? <Loader size={13} className={cls.spinIcon} />
                                                    : <AlertCircle size={13} />
                                            }
                                        </div>

                                        {/* Step index + label */}
                                        <span className={cls.stepIdx}>{idx + 1}</span>
                                        <span className={cls.stepLabel}>{label}</span>

                                        {/* Expand toggle */}
                                        <button
                                            className={cls.stepExpand}
                                            onClick={e => { e.stopPropagation(); toggleTool(idx); }}
                                            aria-label="Toggle details"
                                        >
                                            {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                                        </button>
                                    </div>

                                    {/* Expanded details */}
                                    {isExpanded && (
                                        <div className={cls.stepDetails}>
                                            {tc.arguments && (
                                                <div className={cls.stepArgs}>
                                                    <span className={cls.detailLabel}>Аргументы:</span>
                                                    <code>{formatToolArgs(tc.arguments)}</code>
                                                </div>
                                            )}
                                            {tc.result && (
                                                <div className={cls.stepResult}>
                                                    <span className={cls.detailLabel}>Результат:</span>
                                                    <span>{parseToolResult(tc.result)}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    {isStreaming && (
                        <span className={cls.cursor} aria-hidden />
                    )}
                </div>
            )}

            {/* Timestamp */}
            {!isStreaming && (
                <div className={cls.time}>{formatTime(createdAt)}</div>
            )}
        </div>
    );
};
