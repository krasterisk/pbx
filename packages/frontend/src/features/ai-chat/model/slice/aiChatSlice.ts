import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { AiChatSchema, AiModel, AssistantPanelMode } from '../types/AiChatSchema';

export const ASSISTANT_PANEL_MODE_KEY = 'assistant-panel-mode';

function readStoredPanelMode(): AssistantPanelMode {
    try {
        return localStorage.getItem(ASSISTANT_PANEL_MODE_KEY) === 'workspace'
            ? 'workspace'
            : 'dock';
    } catch {
        return 'dock';
    }
}

function persistPanelMode(mode: AssistantPanelMode) {
    try {
        localStorage.setItem(ASSISTANT_PANEL_MODE_KEY, mode);
    } catch {
        /* ignore */
    }
}

export type AgentTurnOutcome =
    | 'idle'
    | 'streaming'
    | 'done'
    | 'stopped'
    | 'ceiling'
    | 'failed'
    | 'timeout'
    | 'disconnected';

export type AgentChatState = AiChatSchema & {
    turnOutcome: AgentTurnOutcome;
};

const initialState: AgentChatState = {
    isOpen: false,
    isStreaming: false,
    selectedModel: '',
    availableModels: [],
    turnOutcome: 'idle',
    panelMode: readStoredPanelMode(),
};

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

        setModels(state, action: PayloadAction<AiModel[]>) {
            state.availableModels = action.payload;
            if (!state.selectedModel && action.payload.length > 0) {
                state.selectedModel = action.payload[0].name;
            }
        },
        setSelectedModel(state, action: PayloadAction<string>) {
            state.selectedModel = action.payload;
        },

        startTurn(state) {
            state.isStreaming = true;
            state.turnOutcome = 'streaming';
        },

        setTurnOutcome(state, action: PayloadAction<AgentTurnOutcome>) {
            state.turnOutcome = action.payload;
        },

        finishStreaming(state) {
            state.isStreaming = false;
            if (state.turnOutcome === 'streaming') {
                state.turnOutcome = 'done';
            }
        },

        resetTurn(state) {
            state.isStreaming = false;
            state.turnOutcome = 'idle';
        },

        setPanelMode(state, action: PayloadAction<AssistantPanelMode>) {
            state.panelMode = action.payload;
            persistPanelMode(action.payload);
        },
    },
});

export const { actions: aiChatActions } = aiChatSlice;
export const { reducer: aiChatReducer } = aiChatSlice;
