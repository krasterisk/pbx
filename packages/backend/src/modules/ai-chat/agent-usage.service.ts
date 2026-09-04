import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { CcAiProvider } from '../ai-agents/models/ai-provider.model';
import { AgentThread } from './models/agent-thread.model';
import { AgentProposal } from './models/agent-proposal.model';
import { CcAiAuditLog } from '../ai-agents/models/ai-audit-log.model';

export interface TenantUsageRow {
  tenantUid: number;
  tokensIn: number;
  tokensOut: number;
  turns: number;
  spendUsd: number | null;
  spendAvailable: boolean;
}

export interface ProposalFunnelRow {
  tenantUid: number;
  pending: number;
  applied: number;
  rejected: number;
  denied: number;
}

export interface ToolErrorRow {
  tenantUid: number;
  toolName: string;
  status: string;
  count: number;
}

export interface SilentWriteHit {
  tenantUid: number;
  toolName: string;
  auditUid: number;
}

type ThreadUsageRow = {
  vpbx_user_uid: number;
  provider_uid: number | null;
  tokens_in: number;
  tokens_out: number;
};

type ProviderPricing = {
  uid: number;
  pricing: Record<string, unknown> | null;
};

function hasTokenPricing(pricing: unknown): pricing is { inputTokenUsd: number; outputTokenUsd: number } {
  if (!pricing || typeof pricing !== 'object') return false;
  const row = pricing as Record<string, unknown>;
  return typeof row.inputTokenUsd === 'number' && typeof row.outputTokenUsd === 'number';
}

/**
 * Aggregates conversation-row token counters into per-tenant spend (D-08).
 * Reads `ai_agent_threads` only. The voice CDR table is left untouched.
 */
@Injectable()
export class AgentUsageService {
  private readonly logger = new Logger(AgentUsageService.name);

  constructor(
    @InjectModel(AgentThread) private readonly threads: typeof AgentThread,
    @InjectModel(CcAiProvider) private readonly providers: typeof CcAiProvider,
    @InjectModel(AgentProposal) private readonly proposals?: typeof AgentProposal,
    @InjectModel(CcAiAuditLog) private readonly audit?: typeof CcAiAuditLog,
  ) {}

  async queryTenantUsage(from: Date, to: Date): Promise<TenantUsageRow[]> {
    const conversations = (await this.threads.findAll({
      where: { last_message_at: { [Op.between]: [from, to] } },
      attributes: ['vpbx_user_uid', 'provider_uid', 'tokens_in', 'tokens_out'],
    })) as unknown as ThreadUsageRow[];

    const providerRows = (await this.providers.findAll({
      attributes: ['uid', 'pricing'],
    })) as unknown as ProviderPricing[];
    const pricingByUid = new Map(providerRows.map((row) => [row.uid, row.pricing]));

    const grouped = new Map<number, { tokensIn: number; tokensOut: number; turns: number; priced: number; unpriced: boolean }>();
    for (const row of conversations) {
      const current = grouped.get(row.vpbx_user_uid) ?? {
        tokensIn: 0,
        tokensOut: 0,
        turns: 0,
        priced: 0,
        unpriced: false,
      };
      current.tokensIn += Number(row.tokens_in) || 0;
      current.tokensOut += Number(row.tokens_out) || 0;
      current.turns += 1;

      const pricing = row.provider_uid != null ? pricingByUid.get(row.provider_uid) : undefined;
      if (hasTokenPricing(pricing)) {
        current.priced +=
          (Number(row.tokens_in) || 0) * pricing.inputTokenUsd +
          (Number(row.tokens_out) || 0) * pricing.outputTokenUsd;
      } else {
        current.unpriced = true;
      }
      grouped.set(row.vpbx_user_uid, current);
    }

    return [...grouped.entries()]
      .sort(([a], [b]) => a - b)
      .map(([tenantUid, value]) => ({
        tenantUid,
        tokensIn: value.tokensIn,
        tokensOut: value.tokensOut,
        turns: value.turns,
        spendUsd: value.unpriced ? null : value.priced,
        spendAvailable: !value.unpriced,
      }));
  }

  async queryProposalFunnel(_from: Date, _to: Date): Promise<ProposalFunnelRow[]> {
    throw new Error('not implemented');
  }

  async queryToolErrors(_from: Date, _to: Date): Promise<ToolErrorRow[]> {
    throw new Error('not implemented');
  }

  async detectSilentWrites(_from: Date, _to: Date): Promise<SilentWriteHit[]> {
    throw new Error('not implemented');
  }
}
