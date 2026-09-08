// ─────────────────────────────────────────────────────────────────────────────
// AiChat - types
// Design tokens: var(--color-*) from globals.css @theme
// ─────────────────────────────────────────────────────────────────────────────

export interface AiModel {
    name: string;
    displayName: string;
}

export type AssistantPanelMode = 'dock' | 'workspace';

export interface AiChatSchema {
    isOpen: boolean;
    isStreaming: boolean;
    selectedModel: string;
    availableModels: AiModel[];
    panelMode: AssistantPanelMode;
}
