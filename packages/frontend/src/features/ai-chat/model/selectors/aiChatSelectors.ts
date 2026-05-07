import type { StateSchema } from '@/app/store/store';

export const selectAiChatIsOpen = (state: StateSchema) => state.aiChat.isOpen;
export const selectAiChatMessages = (state: StateSchema) => state.aiChat.messages;
export const selectAiChatIsStreaming = (state: StateSchema) => state.aiChat.isStreaming;
export const selectAiChatSelectedModel = (state: StateSchema) => state.aiChat.selectedModel;
export const selectAiChatAvailableModels = (state: StateSchema) => state.aiChat.availableModels;
