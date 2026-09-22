import { memo } from 'react';
import { Text } from '@/shared/ui';

/** Stub until GREEN — TokensTable (D-32, D-33). */
export interface SaApiTokenRow {
  principalId: string;
  name: string;
  projectId: string;
  projectName?: string;
  lastUsed: string | null;
}

export interface TokensTableProps {
  tokens: SaApiTokenRow[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  canIssue?: boolean;
  moduleActive?: boolean;
  onIssue?: (input: { name: string; projectId: string }) => Promise<{ secret: string } | null>;
  onRevoke?: (token: SaApiTokenRow) => Promise<void>;
  projects?: Array<{ id: string; name: string }>;
}

export const TokensTable = memo((_props: TokensTableProps) => (
  <div data-testid="tokens-table-stub">
    <Text>stub</Text>
  </div>
));

TokensTable.displayName = 'TokensTable';
