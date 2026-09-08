/**
 * Shared agent-loop types (D-06). ChatMessage is copied verbatim from
 * AiChatService so 15-08 can delete that file without a type break.
 */

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    name?: string;
    tool_call_id?: string;
    tool_calls?: unknown;
}

export interface AgentToolCall {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
}

export interface AgentTokenUsage {
    promptTokens: number;
    completionTokens: number;
}

export interface AgentLlmError {
    code: string;
    message: string;
    status?: number;
}

export interface AgentCompletion {
    text: string;
    /** Внутренние размышления модели (reasoning_content / reasoning / thinking). Не для UI. */
    reasoning?: string;
    toolCalls: AgentToolCall[];
    usage?: AgentTokenUsage;
    finishReason?: string;
    error?: AgentLlmError;
}

export type AgentSseEventName =
    | 'thread'   // { uid } — первым эвентом, чтобы фронт знал тред до первого элемента
    | 'item'     // AgentTimelineItem — новый элемент или обновление существующего по id
    | 'done'     // { closeKind }
    | 'error';   // { code, message, ... }

export interface AgentToolSpec {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
}

export interface AgentChatParams {
    provider: {
        uid?: number;
        name?: string;
        endpoint: string;
        auth_type?: 'bearer' | 'api_key_header' | 'none' | 'custom';
        encrypted_api_key?: string;
        capabilities?: string[];
        defaults?: Record<string, unknown> | null;
        vendor?: string;
    };
    messages: ChatMessage[];
    tools?: AgentToolSpec[];
    /** OpenAI-compatible tool_choice. Use `required` after empty/no-tool incomplete turns. */
    toolChoice?: 'auto' | 'required' | 'none';
    signal?: AbortSignal;
    stream?: boolean;
    onToken?: (chunk: string) => void;
}
