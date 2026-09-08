import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { CcAiProvider } from '../ai-agents/models/ai-provider.model';
import { CcAiAuditLog } from '../ai-agents/models/ai-audit-log.model';
import { AgentThread } from './models/agent-thread.model';
import { AgentProposal } from './models/agent-proposal.model';
import { AiChatSettings } from './ai-chat-settings.model';
import { Tenant } from '../cloud-admin/tenant.model';
import { CloudSetting } from '../cloud-admin/cloud-setting.model';

const SILENT_WRITE_INTERVAL_MS = 60 * 60 * 1000;
const SILENT_WRITE_WINDOW_MS = 24 * 60 * 60 * 1000;
const MUTATING_TOOL = /^(create_|update_|delete_|remove_|add_|assign_|apply_)/;
const LIVE_OPS = new Set(['cc_force_pause_agent', 'cc_force_unpause_agent']);

export interface TenantUsageRow {
  tenantUid: number;
  tenantName: string | null;
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

export interface DefaultModelProvider {
  uid: number;
  name: string;
  model: string | null;
}

export interface DefaultModelView {
  providerUid: number | null;
  providers: DefaultModelProvider[];
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

function inRange(field: string, from: Date, to: Date) {
  return { [field]: { [Op.between]: [from, to] } };
}

function isMutatingTool(name: string): boolean {
  return !LIVE_OPS.has(name) && MUTATING_TOOL.test(name);
}

/**
 * Aggregates conversation-row token counters into per-tenant spend (D-08).
 * Reads `ai_agent_threads` only. The voice CDR table is left untouched.
 */
@Injectable()
export class AgentUsageService {
  private readonly logger = new Logger(AgentUsageService.name);
  private runningSilent = false;

  constructor(
    @InjectModel(AgentThread) private readonly threads: typeof AgentThread,
    @InjectModel(CcAiProvider) private readonly providers: typeof CcAiProvider,
    @InjectModel(AgentProposal) private readonly proposals: typeof AgentProposal,
    @InjectModel(CcAiAuditLog) private readonly audit: typeof CcAiAuditLog,
    @InjectModel(AiChatSettings) private readonly settings: typeof AiChatSettings,
    @InjectModel(Tenant) private readonly tenants?: typeof Tenant,
    @InjectModel(CloudSetting) private readonly cloudSettings?: typeof CloudSetting,
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

    const names = await this.resolveTenantNames([...grouped.keys()]);

    return [...grouped.entries()]
      .sort(([a], [b]) => a - b)
      .map(([tenantUid, value]) => ({
        tenantUid,
        tenantName: names.get(tenantUid) ?? null,
        tokensIn: value.tokensIn,
        tokensOut: value.tokensOut,
        turns: value.turns,
        spendUsd: value.unpriced ? null : value.priced,
        spendAvailable: !value.unpriced,
      }));
  }

  private async resolveTenantNames(uids: number[]): Promise<Map<number, string>> {
    const names = new Map<number, string>();
    if (uids.length === 0) return names;

    if (this.tenants) {
      try {
        const rows = await this.tenants.findAll({
          where: { vpbx_user_uid: { [Op.in]: uids } },
          attributes: ['name', 'vpbx_user_uid'],
        });
        for (const row of rows) {
          const name = typeof row.name === 'string' ? row.name.trim() : '';
          if (name) names.set(Number(row.vpbx_user_uid), name);
        }
      } catch (error) {
        this.logger.warn(`tenant names unavailable: ${(error as Error).message}`);
      }
    }

    if (uids.includes(0) && !names.has(0) && this.cloudSettings) {
      try {
        const seller = await this.cloudSettings.findOne({
          where: { key: 'billing.seller.name' },
        });
        const sellerName = seller?.value?.trim();
        if (sellerName) names.set(0, sellerName);
      } catch (error) {
        this.logger.warn(`seller name unavailable: ${(error as Error).message}`);
      }
    }

    return names;
  }

  async queryProposalFunnel(from: Date, to: Date): Promise<ProposalFunnelRow[]> {
    const rows = await this.proposals.findAll({
      where: inRange('created_at', from, to),
      attributes: ['vpbx_user_uid', 'status'],
    });
    const grouped = new Map<number, ProposalFunnelRow>();
    for (const row of rows) {
      const tenantUid = Number(row.vpbx_user_uid);
      const current = grouped.get(tenantUid) ?? {
        tenantUid,
        pending: 0,
        applied: 0,
        rejected: 0,
        denied: 0,
      };
      if (row.status === 'pending') current.pending += 1;
      else if (row.status === 'applied') current.applied += 1;
      else if (row.status === 'rejected') current.rejected += 1;
      else if (row.status === 'denied') current.denied += 1;
      grouped.set(tenantUid, current);
    }
    return [...grouped.values()].sort((a, b) => a.tenantUid - b.tenantUid);
  }

  async queryToolErrors(from: Date, to: Date): Promise<ToolErrorRow[]> {
    const rows = await this.audit.findAll({
      where: inRange('created_at', from, to),
      attributes: ['user_uid', 'tool_name', 'status'],
    });
    const grouped = new Map<string, ToolErrorRow>();
    for (const row of rows) {
      const tenantUid = Number(row.user_uid);
      const key = `${tenantUid}\0${row.tool_name}\0${row.status}`;
      const current = grouped.get(key) ?? {
        tenantUid,
        toolName: row.tool_name,
        status: row.status,
        count: 0,
      };
      current.count += 1;
      grouped.set(key, current);
    }
    return [...grouped.values()].sort((a, b) => a.tenantUid - b.tenantUid || a.toolName.localeCompare(b.toolName));
  }

  async detectSilentWrites(from: Date, to: Date): Promise<SilentWriteHit[]> {
    const auditRows = await this.audit.findAll({
      where: inRange('created_at', from, to),
      attributes: ['uid', 'user_uid', 'thread_uid', 'tool_name', 'created_at'],
    });
    const applied = await this.proposals.findAll({
      where: { status: 'applied' },
      attributes: ['vpbx_user_uid', 'thread_uid', 'status', 'applied_at'],
    });

    const hits: SilentWriteHit[] = [];
    for (const row of auditRows) {
      if (!isMutatingTool(row.tool_name)) continue;
      const matched = applied.some(
        (proposal) =>
          proposal.status === 'applied' &&
          Number(proposal.vpbx_user_uid) === Number(row.user_uid) &&
          (row.thread_uid == null || Number(proposal.thread_uid) === Number(row.thread_uid)),
      );
      if (matched) continue;
      const hit = {
        tenantUid: Number(row.user_uid),
        toolName: row.tool_name,
        auditUid: Number(row.uid),
      };
      hits.push(hit);
      this.logger.error(
        `silent write: tenant=${hit.tenantUid} tool=${hit.toolName} audit=${hit.auditUid}`,
      );
    }
    return hits;
  }

  async getDefaultModel(): Promise<DefaultModelView> {
    const rows = await this.providers.findAll({
      attributes: ['uid', 'name', 'defaults', 'capabilities', 'enabled'],
    });
    const providers = rows
      .filter((row) => row.enabled && Array.isArray(row.capabilities) && row.capabilities.includes('llm'))
      .map((row) => ({
        uid: row.uid,
        name: row.name,
        model: typeof row.defaults?.model === 'string' ? row.defaults.model : null,
      }));
    const stored = this.settings
      ? await this.settings.findOne({ where: { user_uid: 0 } })
      : null;
    const raw = stored?.settings?.defaultProviderUid;
    const providerUid = typeof raw === 'number' ? raw : null;
    return { providerUid, providers };
  }

  async setDefaultModel(providerUid: number): Promise<DefaultModelView> {
    const [row] = await this.settings.findOrCreate({
      where: { user_uid: 0 },
      defaults: { user_uid: 0, confirm_destructive: 0, settings: {} } as any,
    });
    const next = { ...(row.settings ?? {}), defaultProviderUid: providerUid };
    await row.update({ settings: next });
    return this.getDefaultModel();
  }

  @Interval('agent-silent-write', SILENT_WRITE_INTERVAL_MS)
  async tickSilentWrites(): Promise<void> {
    if (this.runningSilent) return;
    this.runningSilent = true;
    try {
      const to = new Date();
      const from = new Date(to.getTime() - SILENT_WRITE_WINDOW_MS);
      await this.detectSilentWrites(from, to);
    } catch (error) {
      this.logger.warn(`silent-write scan: ${(error as Error).message}`);
    } finally {
      this.runningSilent = false;
    }
  }
}
