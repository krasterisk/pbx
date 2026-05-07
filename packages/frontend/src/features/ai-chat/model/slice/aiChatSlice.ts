import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type {
    AiChatSchema,
    AiChatMessage,
    AiModel,
    AiToolCallEvent,
} from '../types/AiChatSchema';

// ─── SessionStorage persistence ───────────────────────────────────────────────
const STORAGE_KEY = 'krasterisk_ai_chat_history';
const MAX_STORED_MESSAGES = 50;

function loadMessages(): AiChatMessage[] {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as AiChatMessage[];
        // Reset isStreaming on reload (in case of crash during stream)
        return parsed.map(m => ({ ...m, isStreaming: false }));
    } catch {
        return [];
    }
}

function saveMessages(messages: AiChatMessage[]) {
    try {
        // Keep only last N messages to avoid storage overflow
        const toStore = messages
            .filter(m => !m.isStreaming)
            .slice(-MAX_STORED_MESSAGES);
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    } catch {
        // Storage quota exceeded — clear it
        sessionStorage.removeItem(STORAGE_KEY);
    }
}

// ─── Initial state ────────────────────────────────────────────────────────────

const initialState: AiChatSchema = {
    isOpen: false,
    messages: loadMessages(),
    isStreaming: false,
    selectedModel: '',
    availableModels: [],
};

// ─── Slice ────────────────────────────────────────────────────────────────────

export const aiChatSlice = createSlice({
    name: 'aiChat',
    initialState,
    reducers: {
        openChat(state) {
            state.isOpen = true;
        },
        closeChat(state) {
            state.isOpen = false;
        },
        toggleChat(state) {
            state.isOpen = !state.isOpen;
        },

        // ─── Models ─────────────────────────────────────────────────────────
        setModels(state, action: PayloadAction<AiModel[]>) {
            state.availableModels = action.payload;
            if (!state.selectedModel && action.payload.length > 0) {
                state.selectedModel = action.payload[0].name;
            }
        },
        setSelectedModel(state, action: PayloadAction<string>) {
            state.selectedModel = action.payload;
        },

        // ─── Messages ────────────────────────────────────────────────────────
        addUserMessage(state, action: PayloadAction<string>) {
            const msg: AiChatMessage = {
                id: `user_${Date.now()}`,
                role: 'user',
                content: action.payload,
                createdAt: Date.now(),
            };
            state.messages.push(msg);
            saveMessages(state.messages);
        },

        startAssistantMessage(state) {
            const msg: AiChatMessage = {
                id: `assistant_${Date.now()}`,
                role: 'assistant',
                content: '',
                toolCalls: [],
                isStreaming: true,
                createdAt: Date.now(),
            };
            state.messages.push(msg);
            state.isStreaming = true;
        },

        appendTextChunk(state, action: PayloadAction<string>) {
            const last = state.messages[state.messages.length - 1];
            if (last && last.role === 'assistant') {
                last.content += action.payload;
            }
        },

        addToolCall(state, action: PayloadAction<AiToolCallEvent>) {
            const last = state.messages[state.messages.length - 1];
            if (last && last.role === 'assistant') {
                if (!last.toolCalls) last.toolCalls = [];
                last.toolCalls.push(action.payload);
            }
        },

        updateToolResult(state, action: PayloadAction<{ name: string; result: string }>) {
            const last = state.messages[state.messages.length - 1];
            if (last?.toolCalls) {
                // Find the last tool_call with this name that has no result yet
                const tc = [...last.toolCalls]
                    .reverse()
                    .find(t => t.name === action.payload.name && !t.result);
                if (tc) tc.result = action.payload.result;
            }
        },

        finishStreaming(state) {
            const last = state.messages[state.messages.length - 1];
            if (last) last.isStreaming = false;
            state.isStreaming = false;
            // Persist after stream completes
            saveMessages(state.messages);
        },

        clearMessages(state) {
            state.messages = [];
            sessionStorage.removeItem(STORAGE_KEY);
        },

        /** Remove the last (incomplete) assistant message on error */
        removeLastAssistantMessage(state) {
            const last = state.messages[state.messages.length - 1];
            if (last?.role === 'assistant' && last.isStreaming) {
                state.messages.pop();
            }
            state.isStreaming = false;
        },
    },
});

export const { actions: aiChatActions } = aiChatSlice;
export const { reducer: aiChatReducer } = aiChatSlice;
