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
