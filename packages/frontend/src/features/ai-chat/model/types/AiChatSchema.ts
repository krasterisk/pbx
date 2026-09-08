// ─────────────────────────────────────────────────────────────────────────────
// AiChat - types
// Design tokens: var(--color-*) from globals.css @theme
// ─────────────────────────────────────────────────────────────────────────────

export interface AiModel {
    name: string;
    displayName: string;
}

export interface AiChatSchema {
    isOpen: boolean;
    isStreaming: boolean;
    selectedModel: string;
    availableModels: AiModel[];
}
