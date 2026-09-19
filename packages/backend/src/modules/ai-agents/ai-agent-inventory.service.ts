import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { CcAiAgent } from './models/ai-agent.model';
import { CcAiProvider } from './models/ai-provider.model';
import { CcAiToolset } from './models/ai-toolset.model';
import {
  assessAgentReadiness, type AgentConfigurationReadiness, type SafeProvider,
} from './ai-agent-readiness';

export interface AiAgentInventoryRow {
  uid: number;
  uniqueId: string;
  name: string;
  mode: 'realtime' | 'cascade';
  enabled: boolean;
  providerIds: { model: number | null; stt: number | null; tts: number | null };
  toolsetId: number | null;
  readiness: AgentConfigurationReadiness;
}

export interface AiAgentInventoryPage {
  items: AiAgentInventoryRow[];
  nextCursor: number | null;
}

export interface LegacyAgentMigrationReport {
  tenantUid: number;
  scanned: number;
  invalidAgents: Array<{ uid: number; issues: AgentConfigurationReadiness['issues'] }>;
  duplicateUniqueIds: Array<{ uniqueId: string; uids: number[] }>;
  truncated: boolean;
  nextCursor: number | null;
}

/** Read-only, tenant-exact inventory. No provider secret or tool payload is selected. */
@Injectable()
export class AiAgentInventoryService {
  constructor(
    @InjectModel(CcAiAgent) private readonly agentModel: typeof CcAiAgent,
    @InjectModel(CcAiProvider) private readonly providerModel: typeof CcAiProvider,
    @InjectModel(CcAiToolset) private readonly toolsetModel: typeof CcAiToolset,
  ) {}

  /** Compatibility helper returning only the first bounded page. */
  async listForTenant(userUid: number): Promise<AiAgentInventoryRow[]> {
    return (await this.listPageForTenant(userUid)).items;
  }

  /** Read-only migration preview; a truncated report is never a clean bill of health. */
  async reportLegacyForTenant(userUid: number, maxRows = 1000): Promise<LegacyAgentMigrationReport> {
    if (!Number.isSafeInteger(maxRows) || maxRows < 1 || maxRows > 10000) {
      throw new BadRequestException({ code: 'agent_inventory_report_limit_invalid' });
    }
    let cursor = 0;
    let nextCursor: number | null = null;
    let scanned = 0;
    const invalidAgents: LegacyAgentMigrationReport['invalidAgents'] = [];
    const seen = new Map<string, number[]>();
    while (scanned < maxRows) {
      const page = await this.listPageForTenant(userUid, Math.min(100, maxRows - scanned), cursor);
      for (const agent of page.items) {
        scanned++;
        if (!agent.readiness.ready) invalidAgents.push({ uid: agent.uid, issues: agent.readiness.issues });
        seen.set(agent.uniqueId, [...(seen.get(agent.uniqueId) ?? []), agent.uid]);
      }
      nextCursor = page.nextCursor;
      if (nextCursor === null || scanned >= maxRows) break;
      cursor = nextCursor;
    }
    return {
      tenantUid: userUid, scanned, invalidAgents,
      duplicateUniqueIds: [...seen.entries()]
        .filter(([, uids]) => uids.length > 1)
        .map(([uniqueId, uids]) => ({ uniqueId, uids })),
      truncated: nextCursor !== null, nextCursor,
    };
  }

  async listPageForTenant(userUid: number, limit = 100, afterUid = 0): Promise<AiAgentInventoryPage> {
    if (!Number.isSafeInteger(userUid) || userUid < 0
      || !Number.isSafeInteger(limit) || limit < 1 || limit > 100
      || !Number.isSafeInteger(afterUid) || afterUid < 0) {
      throw new BadRequestException({ code: 'agent_inventory_page_invalid' });
    }
    const agents = await this.agentModel.findAll({
      where: { user_uid: userUid, ...(afterUid > 0 ? { uid: { [Op.gt]: afterUid } } : {}) },
      attributes: [
        'uid', 'name', 'unique_id', 'mode', 'enabled', 'model_profile_id',
        'stt_profile_id', 'tts_profile_id', 'toolset_id',
      ],
      order: [['uid', 'ASC']], limit: limit + 1,
    });
    const hasNext = agents.length > limit;
    const page = agents.slice(0, limit);
    const providerIds = [...new Set(page.flatMap((agent) => [
      agent.model_profile_id, agent.stt_profile_id, agent.tts_profile_id,
    ]).filter((uid): uid is number => Number.isSafeInteger(uid) && Number(uid) > 0))];
    const toolsetIds = [...new Set(page.map((agent) => agent.toolset_id)
      .filter((uid): uid is number => Number.isSafeInteger(uid) && Number(uid) > 0))];
    const [providers, toolsets] = await Promise.all([
      providerIds.length ? this.providerModel.findAll({
        where: { user_uid: userUid, uid: { [Op.in]: providerIds } },
        attributes: ['uid', 'user_uid', 'enabled', 'capabilities'],
      }) : Promise.resolve([]),
      toolsetIds.length ? this.toolsetModel.findAll({
        where: { user_uid: userUid, uid: { [Op.in]: toolsetIds } },
        attributes: ['uid'],
      }) : Promise.resolve([]),
    ]);
    const providerById = new Map<number, SafeProvider>(providers.map((item) => [item.uid, item]));
    const toolsetSet = new Set(toolsets.map((item) => item.uid));
    return {
      items: page.map((agent) => ({
        uid: agent.uid, uniqueId: agent.unique_id, name: agent.name,
        mode: agent.mode, enabled: agent.enabled,
        providerIds: {
          model: agent.model_profile_id ?? null,
          stt: agent.stt_profile_id ?? null,
          tts: agent.tts_profile_id ?? null,
        },
        toolsetId: agent.toolset_id ?? null,
        readiness: assessAgentReadiness(agent, userUid, providerById, toolsetSet),
      })),
      nextCursor: hasNext ? page[page.length - 1].uid : null,
    };
  }
}
