import { plainToInstance, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
  ValidateNested,
  validateSync,
} from 'class-validator';
import type { AgentDiffProposal } from '../../ai-platform/ai-adapter.types';

export class AgentApplyPayloadDto {
  @IsString()
  tool!: string;

  @IsObject()
  args!: Record<string, unknown>;

  /** Adapter schema version stamped server-side; stale stored payloads refuse at confirm. */
  @IsOptional()
  @IsString()
  schemaVersion?: string;
}

/**
 * Validated proposal accepted by createProposal.
 * Identifier is optional on input — the service generates it.
 */
export class AgentDiffProposalDto {
  @IsOptional()
  @IsUUID()
  proposalId?: string;

  @IsString()
  entityType!: string;

  @IsString()
  entityLabel!: string;

  @IsArray()
  @IsString({ each: true })
  summary!: string[];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsObject()
  before?: Record<string, unknown> | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsObject()
  after?: Record<string, unknown> | null;

  @ValidateNested()
  @Type(() => AgentApplyPayloadDto)
  applyPayload!: AgentApplyPayloadDto;

  @IsBoolean()
  includesDialplanReload!: boolean;
}

/** Client-facing view — apply payload omitted by type, never stripped at call sites. */
export type AgentProposalView = Omit<AgentDiffProposal, 'applyPayload'> & {
  proposalId: string;
  status: string;
  expiresAt: string;
  appliedAt?: string | null;
  error?: string | null;
};

export function parseAgentDiffProposal(plain: unknown): AgentDiffProposalDto {
  const dto = plainToInstance(AgentDiffProposalDto, plain);
  const errors = validateSync(dto, { whitelist: true, forbidNonWhitelisted: true });
  if (errors.length) {
    throw new Error(`PROPOSAL_INVALID:${errors.map((error) => error.property).join(',')}`);
  }
  return dto;
}

export function toProposalView(row: {
  proposal_id: string;
  entity_type: string;
  entity_label: string;
  summary: string[];
  before_json: Record<string, unknown> | null;
  after_json: Record<string, unknown> | null;
  includes_dialplan_reload: boolean;
  status: string;
  expires_at: Date;
  applied_at?: Date | null;
  error?: string | null;
}): AgentProposalView {
  return {
    proposalId: row.proposal_id,
    entityType: row.entity_type,
    entityLabel: row.entity_label,
    summary: row.summary,
    before: row.before_json,
    after: row.after_json,
    includesDialplanReload: row.includes_dialplan_reload,
    status: row.status,
    expiresAt: row.expires_at instanceof Date ? row.expires_at.toISOString() : String(row.expires_at),
    appliedAt: row.applied_at
      ? row.applied_at instanceof Date
        ? row.applied_at.toISOString()
        : String(row.applied_at)
      : null,
    error: row.error ?? null,
  };
}

export function isAgentDiffProposal(value: unknown): value is AgentDiffProposal {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'applyPayload' in value &&
    !!(value as AgentDiffProposal).applyPayload
  );
}

export function isProposalClientView(value: unknown): value is AgentProposalView {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'proposalId' in value &&
    !('applyPayload' in value)
  );
}

export function isWorkflowPlanView(value: unknown): value is { workflowId: string; steps: unknown[] } {
  return (
    !!value && typeof value === 'object' && !Array.isArray(value) &&
    'workflowId' in value && typeof (value as { workflowId: unknown }).workflowId === 'string' &&
    Array.isArray((value as { steps?: unknown }).steps)
  );
}
