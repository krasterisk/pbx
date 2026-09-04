import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type {
    AiChatSchema,
    AiChatMessage,
    AiModel,
    AiToolCallEvent,
} from '../types/AiChatSchema';

export type AgentTurnOutcome =
    | 'idle'
    | 'streaming'
    | 'done'
    | 'stopped'
    | 'ceiling'
    | 'failed'
    | 'disconnected';

export type AgentChatState = AiChatSchema & {
    progressLines: string[];
    turnOutcome: AgentTurnOutcome;
};

// ─── Initial state ────────────────────────────────────────────────────────────
// Committed messages live on the server (thread detail query). This store
// holds only the in-flight turn so a reload cannot diverge from the rail.

const initialState: AgentChatState = {
    isOpen: false,
    messages: [],
    isStreaming: false,
    selectedModel: '',
    availableModels: [],
    progressLines: [],
    turnOutcome: 'idle',
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
            state.progressLines = [];
            state.turnOutcome = 'streaming';
        },

        addProgressLine(state, action: PayloadAction<string>) {
            state.progressLines.push(action.payload);
        },

        setTurnOutcome(state, action: PayloadAction<AgentTurnOutcome>) {
            state.turnOutcome = action.payload;
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
            if (state.turnOutcome === 'streaming') {
                state.turnOutcome = 'done';
            }
        },

        clearMessages(state) {
            state.messages = [];
            state.progressLines = [];
            state.turnOutcome = 'idle';
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
