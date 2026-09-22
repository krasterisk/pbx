/**
 * Stub for TDD RED — Task 18-05-1. GREEN replaces with full sheet.
 */
export type ConversationSourceKind = 'pbx' | 'upload' | 'api';

export interface ConversationRunCost {
  id: string;
  amount: string | null;
  currency: string | null;
  createdAt: string;
}

export interface ConversationSheetProps {
  open: boolean;
  conversationId: string | null;
  onOpenChange: (open: boolean) => void;
  sourceKind: ConversationSourceKind;
  audioUrl?: string | null;
  rebuildInProgress?: boolean;
  summary?: string | null;
  transcriptText?: string | null;
  runs?: ConversationRunCost[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

export function ConversationSheet(_props: ConversationSheetProps) {
  return <div data-testid="conversation-sheet-stub" />;
}
