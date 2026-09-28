import { BadRequestException, ConflictException, ForbiddenException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Op, Transaction } from 'sequelize';
import { createHash, randomUUID } from 'node:crypto';
import { AI_VOICE_ROBOT_DEFAULTS, validateAiVoiceConfig, type AiVoiceRobot, type AiVoiceRobotConfig } from '@krasterisk/shared';
import { CcAiAgent } from '../ai-agents/models/ai-agent.model';
import { CcAiProvider } from '../ai-connectivity/ai-provider.model';
import { ProductAccessService } from '../product-access/product-access.service';
import { AiBusinessConnection } from '../ai-tool-connectivity/tool.models';
import { KbBase } from '../knowledge/knowledge.models';
import { AiRobotDeployment, AiRobotDraft, AiRobotVersion } from './ai-voice.models';
import { DEFAULT_RUNTIME_POLICY } from './voice-engine';

interface VoiceProviderSnapshot {
  id: string;
  providerUid: number;
  tenantUid: number;
  capability: string;
  kind: string;
  vendor: string;
  endpoint: string;
  authType: string;
  defaults: Record<string, string | number | boolean>;
}

export function robotConfigFromRows(agent: CcAiAgent, draft?: AiRobotDraft | null): AiVoiceRobotConfig {
  const policy = draft ? JSON.parse(draft.runtime_policy) : {};
  const vad = agent.vad_config || {};
  return {
    ...structuredClone(AI_VOICE_ROBOT_DEFAULTS),
    ...(typeof vad.threshold === 'number' ? { vadThreshold: vad.threshold } : {}),
    ...(typeof vad.silenceMs === 'number' ? { silenceDurationMs: vad.silenceMs } : {}),
    ...(typeof vad.prefixPaddingMs === 'number' ? { prefixPaddingMs: vad.prefixPaddingMs } : {}),
    ...(typeof policy.maxCallMs === 'number' ? { maxCallMs: policy.maxCallMs } : {}),
    ...policy.settings,
    name: agent.name, uniqueId: agent.unique_id, enabled: agent.enabled,
    mode: agent.mode, voice: agent.voice || '', greeting: agent.greeting || '', instruction: agent.instruction || '',
    modelProfileId: agent.model_profile_id ?? null, sttProfileId: agent.stt_profile_id ?? null,
    ttsProfileId: agent.tts_profile_id ?? null,
  };
}

@Injectable()
export class RobotConfigService {
  constructor(
    private readonly sequelize: Sequelize,
    private readonly products: ProductAccessService,
    @InjectModel(CcAiAgent) private readonly agents: typeof CcAiAgent,
    @InjectModel(CcAiProvider) private readonly providers: typeof CcAiProvider,
    @InjectModel(AiRobotDraft) private readonly drafts: typeof AiRobotDraft,
    @InjectModel(AiRobotVersion) private readonly versions: typeof AiRobotVersion,
    @InjectModel(AiRobotDeployment) private readonly deployments: typeof AiRobotDeployment,
    @InjectModel(AiBusinessConnection) private readonly tools: typeof AiBusinessConnection,
    @InjectModel(KbBase) private readonly bases: typeof KbBase,
  ) {}

  private async access(tenantUid: number) {
    const decision = await this.products.decide(tenantUid, 'ai_voice_robots');
    if (!decision.allowed) throw new ForbiddenException({ code: decision.reason ?? 'not_entitled' });
  }

  async list(tenantUid: number): Promise<AiVoiceRobot[]> {
    await this.access(tenantUid);
    const [agents, drafts, deployments] = await Promise.all([
      this.agents.findAll({ where: { user_uid: tenantUid }, order: [['name', 'ASC']] }),
      this.drafts.findAll({ where: { tenant_uid: tenantUid } }),
      this.deployments.findAll({ where: { tenant_uid: tenantUid, kind: 'internal' } }),
    ]);
    return agents.filter(agent => {
      const draft = drafts.find(row => row.agent_uid === agent.uid);
      return !draft || !JSON.parse(draft.runtime_policy).archived;
    }).map(agent => {
      const draft = drafts.find(row => row.agent_uid === agent.uid);
      return { uid: agent.uid, robotUuid: draft?.robot_uuid ?? '', revision: draft?.draft_revision ?? 1,
        versionId: deployments.find(row => row.agent_uid === agent.uid)?.active_version_id ?? null,
        config: robotConfigFromRows(agent, draft) };
    });
  }

  async get(tenantUid: number, uid: number): Promise<AiVoiceRobot> {
    const robot = (await this.list(tenantUid)).find(row => row.uid === uid);
    if (!robot) throw new NotFoundException({ code: 'resource_not_found' });
    return robot;
  }

  private async validateReferences(tenantUid: number, config: AiVoiceRobotConfig, transaction: Transaction) {
    const snapshots: Record<'llm' | 'stt' | 'tts', VoiceProviderSnapshot | null> = { llm: null, stt: null, tts: null };
    const roles: Array<['llm' | 'stt' | 'tts', number | null, string]> = [['llm', config.modelProfileId, config.mode === 'realtime' ? 'realtime' : 'llm']];
    if (config.mode === 'cascade') roles.push(['stt', config.sttProfileId, 'stt'], ['tts', config.ttsProfileId, 'tts']);
    for (const [role, uid, capability] of roles) {
      const row = await this.providers.findOne({ where: { uid, user_uid: tenantUid, enabled: true, is_global: false }, transaction });
      if (!row || !row.capabilities.includes(capability)) {
        throw new BadRequestException({ code: 'provider_unavailable', uid });
      }
      // Pin nonsecret connection settings. Resolve current credentials separately at runtime;
      // never copy encrypted credentials or arbitrary custom headers into robot snapshots.
      const defaults: VoiceProviderSnapshot['defaults'] = {};
      for (const key of ['model', 'voice', 'language', 'temperature', 'speed', 'sample_rate', 'format', 'folder_id']) {
        const value: unknown = row.defaults?.[key];
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') defaults[key] = value;
      }
      snapshots[role] = { id: randomUUID(), tenantUid, providerUid: Number(uid), capability,
        kind: row.kind, vendor: row.vendor, endpoint: row.endpoint, authType: row.auth_type, defaults };
    }
    for (const [ids, kind] of [[config.toolIds, 'tools'], [config.mcpServerIds, 'mcp'], [config.knowledgeBaseIds, 'bases']] as const) {
      if (!ids.length) continue;
      const where = { tenant_uid: tenantUid, id: { [Op.in]: [...new Set(ids)] }, status: { [Op.ne]: 'archived' } };
      const count = kind === 'bases' ? await this.bases.count({ where, transaction })
        : await this.tools.count({ where: { ...where, kind: kind === 'mcp' ? 'mcp' : { [Op.ne]: 'mcp' } }, transaction });
      if (count !== new Set(ids).size) throw new BadRequestException({ code: 'binding_not_found' });
    }
    return snapshots;
  }

  async save(tenantUid: number, userId: number, config: AiVoiceRobotConfig, uid?: number, expectedRevision?: number): Promise<AiVoiceRobot> {
    await this.access(tenantUid);
    const issues = validateAiVoiceConfig(config);
    if (issues.length) throw new BadRequestException({ code: 'invalid_robot_configuration', issues });
    return this.sequelize.transaction(async transaction => {
      let agent = uid ? await this.agents.findOne({ where: { uid, user_uid: tenantUid }, transaction, lock: transaction.LOCK.UPDATE }) : null;
      if (uid && !agent) throw new NotFoundException({ code: 'resource_not_found' });
      let draft = agent ? await this.drafts.findOne({ where: { tenant_uid: tenantUid, agent_uid: agent.uid }, transaction, lock: transaction.LOCK.UPDATE }) : null;
      if (draft && JSON.parse(draft.runtime_policy).archived) throw new NotFoundException({ code: 'resource_not_found' });
      if (uid) {
        if (!Number.isSafeInteger(expectedRevision)) throw new HttpException({ code: 'revision_required' }, 428);
        if ((draft?.draft_revision ?? 1) !== expectedRevision) throw new ConflictException({ code: 'stale_draft' });
      }
      const providers = await this.validateReferences(tenantUid, config, transaction);
      const duplicate = await this.agents.findOne({ where: { user_uid: tenantUid, unique_id: config.uniqueId,
        ...(uid ? { uid: { [Op.ne]: uid } } : {}) }, transaction });
      if (duplicate) throw new ConflictException({ code: 'identifier_in_use' });
      const values = { name: config.name.trim(), unique_id: config.uniqueId, enabled: config.enabled,
        mode: config.mode, voice: config.voice, greeting: config.greeting, instruction: config.instruction,
        model_profile_id: config.modelProfileId, stt_profile_id: config.sttProfileId, tts_profile_id: config.ttsProfileId,
        vad_config: { threshold: config.vadThreshold, silenceMs: config.silenceDurationMs, prefixPaddingMs: config.prefixPaddingMs },
        updated_at: new Date() };
      if (agent) await agent.update(values, { transaction });
      else agent = await this.agents.create({ ...values, user_uid: tenantUid, channel_kind: 'local', created_at: new Date() }, { transaction });
      const revision = uid ? (draft?.draft_revision ?? 1) + 1 : 1;
      const oldPolicy = draft ? JSON.parse(draft.runtime_policy) : DEFAULT_RUNTIME_POLICY;
      const policy = { ...oldPolicy, settings: config, archived: false, prerollMs: config.prefixPaddingMs,
        endpointSilenceMs: config.silenceDurationMs, maxCallMs: config.maxCallMs, transferTargetIds: config.transferTargets };
      if (draft) await draft.update({ draft_revision: revision, runtime_policy: JSON.stringify(policy), updated_at: new Date() }, { transaction });
      else draft = await this.drafts.create({ tenant_uid: tenantUid, agent_uid: agent.uid, robot_uuid: randomUUID(),
        draft_revision: revision, runtime_policy: JSON.stringify(policy), created_at: new Date(), updated_at: new Date() }, { transaction });
      const last = await this.versions.max('version_no', { where: { tenant_uid: tenantUid, agent_uid: agent.uid }, transaction });
      const { settings: _settings, ...runtimePolicy } = policy;
      const snapshot = JSON.stringify({ schemaVersion: 1, settings: config, policy: runtimePolicy, providers });
      if (Buffer.byteLength(snapshot, 'utf8') > 60000) throw new BadRequestException({ code: 'configuration_too_large' });
      const version = await this.versions.create({ id: randomUUID(), tenant_uid: tenantUid, agent_uid: agent.uid,
        version_no: Number(last || 0) + 1, config_digest: createHash('sha256').update(snapshot).digest('hex'),
        config: snapshot, llm_revision_id: providers.llm!.id,
        stt_revision_id: providers.stt?.id ?? null,
        tts_revision_id: providers.tts?.id ?? null, created_by: userId, created_at: new Date() }, { transaction });
      // Internal compatibility bindings are managed by Save, never by the operator.
      for (const kind of ['internal', 'browser_test']) {
        const rows = await this.deployments.findAll({ where: { tenant_uid: tenantUid, agent_uid: agent.uid, kind }, transaction });
        const values = { active_version_id: version.id, status: config.enabled ? 'ready' : 'disabled', updated_at: new Date() };
        if (rows.length) for (const row of rows) await row.update({ ...values, revision: row.revision + 1,
          capture_policy: JSON.stringify({ ...JSON.parse(row.capture_policy || '{}'), analytic: config.analytic }) }, { transaction });
        else await this.deployments.create({ ...values, id: randomUUID(), tenant_uid: tenantUid, agent_uid: agent.uid, kind,
          revision: 1, capture_policy: JSON.stringify({ mode: 'allow', analytic: config.analytic }),
          fallback_policy: JSON.stringify({ action: 'continue' }), created_at: new Date() }, { transaction });
      }
      return { uid: agent.uid, robotUuid: draft.robot_uuid, revision, versionId: version.id, config };
    });
  }
}
