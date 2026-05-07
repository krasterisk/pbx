// ─────────────────────────────────────────────────────────────────────────────
// AiChat — types
// Design tokens: var(--color-*) from globals.css @theme
// ─────────────────────────────────────────────────────────────────────────────

export type AiChatRole = 'user' | 'assistant';
export type AiChatEventType = 'text' | 'tool_call' | 'tool_result' | 'done' | 'error';

export interface AiChatHistoryMessage {
    role: AiChatRole;
    content: string;
}

export interface AiChatMessage {
    id: string;
    role: AiChatRole;
    /** Full accumulated text for assistant, or user input */
    content: string;
    /** SSE tool_call events received during this message */
    toolCalls?: AiToolCallEvent[];
    isStreaming?: boolean;
    createdAt: number;
}

export interface AiToolCallEvent {
    name: string;
    arguments: string;
    result?: string;
}

export interface AiModel {
    name: string;
    displayName: string;
}

export interface AiChatSchema {
    isOpen: boolean;
    messages: AiChatMessage[];
    isStreaming: boolean;
    selectedModel: string;
    availableModels: AiModel[];
}
