import type { AgentStreamEvent } from './pbx-agent-loop.service';

export type EvalBucket =
  | 'read'
  | 'mutating'
  | 'cross-tenant'
  | 'diagnostic'
  | 'step-budget';

export interface EvalModelTurn {
  text?: string;
  toolCalls?: Array<{
    id?: string;
    name: string;
    arguments?: Record<string, unknown>;
  }>;
}

export interface EvalScenario {
  id: string;
  bucket: EvalBucket;
  input: string;
  tenantUid: number;
  authorUid?: number;
  role?: number;
  locale?: string;
  maxSteps?: number;
  modelTurns: EvalModelTurn[];
  expectedToolSequence: string[];
  expectedProposal?: {
    entityType: string;
    entityLabel?: string;
    status?: string;
  };
  assertNoWrite?: boolean;
  peerTenantUid?: number;
  forgedTenantUid?: number;
  expectedTerminal?: { code: string };
}

export interface EvalAuditRow {
  user_uid: number;
  tool?: string;
  source: 'action_log' | 'cc_ai_audit_log';
}

export interface EvalRunResult {
  events: AgentStreamEvent[];
  toolSequence: string[];
  auditRows: EvalAuditRow[];
  proposals: Array<{ entityType: string; entityLabel: string; status: string }>;
  entityCountsBefore: Record<string, number>;
  entityCountsAfter: Record<string, number>;
  peerEntityCountsBefore?: Record<string, number>;
  peerEntityCountsAfter?: Record<string, number>;
  outboundRequests: number;
}

export function loadReferenceScenarios(_filePath?: string): EvalScenario[] {
  throw new Error('eval harness not implemented');
}

export async function runScenario(_scenario: EvalScenario): Promise<EvalRunResult> {
  throw new Error('eval harness not implemented');
}

export function assertToolSequence(_actual: string[], _expected: string[]): void {
  throw new Error('eval harness not implemented');
}
