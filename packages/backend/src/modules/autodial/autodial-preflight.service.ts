import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { QueryTypes } from 'sequelize';
import {
  AUTODIAL_CONTRACT_VERSION, AUTODIAL_SUPPORTED_ACTIONS, AUTODIAL_DIAL_MODES, AUTODIAL_FIELD_TYPES,
  AUTODIAL_DISPOSITIONS, autodialScenarioJsonSchema, type IRouteAction, type IAutodialCampaign, type IAutodialSchedule, type IAutodialPreflight, type IAutodialPreflightCheck,
} from '@krasterisk/shared';
import { AmiService } from '../ami/ami.service';
import { AriConnectionService } from '../ari/ari-connection.service';
import { PromptsService } from '../prompts/prompts.service';
import { AutodialCampaignsService, assertAutodialSchedules, toAutodialTrunkPool } from './autodial-campaigns.service';
import type { CreateAutodialCampaignDto, AutodialSchedulePreviewDto } from './dto/autodial-campaign.dto';
import { AutodialDiagnosisService } from './autodial-diagnosis.service';
import { AutodialDialplanService } from './autodial-dialplan.service';
import { autodialSqlDate } from './autodial-sql-time.util';
import { defaultAutodialAmd, defaultAutodialCidPolicy, normalizeAutodialPacing, normalizeAutodialRetry, queueNamesFromPacing } from './autodial-campaign.defaults';
import { campaignWindowOpen, subscriberHoursAllowForSchedules } from './autodial-schedule.util';
import { nextAutodialWindow } from './autodial-next-window.util';
import { AiProvidersService } from '../ai-connectivity/ai-providers.service';
import { autodialTtsCapability } from './autodial-tts-capability.util';

@Injectable()
export class AutodialPreflightService {
  constructor(
    private readonly campaigns: AutodialCampaignsService,
    private readonly diagnosis: AutodialDiagnosisService,
    private readonly dialplan: AutodialDialplanService,
    private readonly ami: AmiService,
    private readonly ari: AriConnectionService,
    private readonly prompts: PromptsService,
    @InjectConnection() private readonly db: Sequelize,
    private readonly providers: AiProvidersService,
  ) {}

  async capabilities(userUid: number) {
    const [engines, queues, robots, llms] = await Promise.all([
      Promise.all([this.providers.findAll(userUid, 'tts'), this.providers.findGlobal('tts')])
        .then((groups) => groups.flat().filter((row) => row.enabled).map(autodialTtsCapability)),
      this.db.query<{ name: string; display_name: string | null }>('SELECT name, display_name FROM queue_table WHERE vpbx_user_uid = :userUid', { replacements: { userUid }, type: QueryTypes.SELECT }),
      this.db.query<{ uid: number; name: string }>('SELECT uid, name FROM voice_robots WHERE user_uid = :userUid', { replacements: { userUid }, type: QueryTypes.SELECT }),
      Promise.all([this.providers.findAll(userUid, 'llm'), this.providers.findGlobal('llm')]).then((groups) => groups.flat().filter((row) => row.enabled)),
    ]);
    return { version: AUTODIAL_CONTRACT_VERSION, modes: AUTODIAL_DIAL_MODES, actions: AUTODIAL_SUPPORTED_ACTIONS,
      scenario_schema: autodialScenarioJsonSchema(), field_types: AUTODIAL_FIELD_TYPES, dispositions: AUTODIAL_DISPOSITIONS,
      pacing_providers: ['static', 'queue_agents', 'trunk_channels', 'tenant_cap'],
      speech_variables: { suffixes: ['_SAY_MONEY', '_SAY_DATE', '_SAY_NUMBER', '_SAY_DIGITS'], locale: 'ru-RU',
        usage: '{AC_DEBT_SAY_MONEY}; derived from the same customer field, money uses field currency; missing or invalid values remain absent' },
      business_outcomes: 'collect_input.params.outcomeMap maps exact DTMF values to business outcome slugs in scenario_result.business_outcome; separate from technical disposition',
      limits: { scenario_steps: 100, report_days: 366 }, ai: { configured: llms.length > 0, validation: 'configuration_only' }, tts_engines: engines, queues, voice_robots: robots };
  }

  previewSchedule(input: AutodialSchedulePreviewDto) {
    assertAutodialSchedules(input.schedules);
    const rows: IAutodialSchedule[] = input.schedules.map((row, index) => ({ ...row, uid: index + 1, campaign_uid: 0,
      timezone: row.timezone!, weekday: row.weekday ?? null, date_from: row.date_from || null, date_to: row.date_to || null, enabled: row.enabled ?? true }));
    const now = new Date();
    return { checked_at: now.toISOString(), campaign_open: campaignWindowOpen(rows, now),
      subscriber_open: input.tz_offset_min === undefined ? null : subscriberHoursAllowForSchedules(input.tz_offset_min, now, rows),
      next_allowed_at: nextAutodialWindow(rows, now, input.tz_offset_min)?.toISOString() ?? null, horizon_days: 370 };
  }

  /** Used before AI proposal creation as well as immediately before execution. */
  async validateDraft(userUid: number, input: Parameters<AutodialCampaignsService['validateConfiguration']>[1],
    plannedBase?: Parameters<AutodialCampaignsService['validateConfiguration']>[2]) {
    await this.campaigns.validateConfiguration(userUid, input, plannedBase);
    const actions = (input.scenario_actions ?? []) as IRouteAction[];
    const files = new Set<string>();
    const engineIds = new Set<number>();
    const robotIds = new Set<number>();
    const deployments = new Set<string>();
    for (const action of actions) {
      if (action.enabled === false) continue;
      const params = action.params ?? {};
      if (action.type === 'collect_input' && params.promptFile) files.add(String(params.promptFile));
      if (action.type === 'toqueue' && params.announceoverride) files.add(String(params.announceoverride));
      if (action.type === 'playback') {
        const value = params.files ?? params.file ?? params.prompt;
        for (const file of (Array.isArray(value) ? value : String(value ?? '').split('&'))) if (file) files.add(String(file));
      }
      if (action.type === 'text2speech') {
        const engine = Number(params.engine);
        if (!Number.isInteger(engine) || engine <= 0) throw new BadRequestException({ code: 'AC_TTS_REQUIRED', message: 'Choose a tenant TTS engine' });
        engineIds.add(engine);
      }
      if (action.type === 'voicerobot') robotIds.add(Number(params.robot_uid ?? params.robotUid));
      if (action.type === 'ai_voice_robot') deployments.add(String(params.deployment_id ?? params.deploymentId ?? ''));
    }
    for (const filename of files) {
      if (!(await this.prompts.resolvePromptAudioFile(userUid, filename))) {
        throw new BadRequestException({ code: 'AC_PROMPT_NOT_FOUND', message: `Prompt is unavailable: ${filename}` });
      }
    }
    if (engineIds.size) {
      for (const uid of engineIds) {
        try { await this.providers.revisionForOperation(userUid, uid, 'tts'); }
        catch { throw new BadRequestException({ code: 'AC_TTS_REQUIRED', message: 'TTS provider is unavailable for this tenant' }); }
        try { await this.providers.loadSpeechEngine(userUid, uid, 'tts'); }
        catch { throw new BadRequestException({ code: 'AC_TTS_CREDENTIAL_UNAVAILABLE', message: 'TTS credentials cannot be resolved. Check provider configuration and installation keyring.' }); }
      }
    }
    if (robotIds.size) {
      const robots = await this.db.query<{ uid: number }>('SELECT uid FROM voice_robots WHERE user_uid = :userUid AND uid IN (:ids)', {
        replacements: { userUid, ids: [...robotIds] }, type: QueryTypes.SELECT,
      });
      if (robots.length !== robotIds.size) throw new BadRequestException({ code: 'AC_ROBOT_NOT_FOUND', message: 'Voice robot does not belong to this tenant' });
    }
    if (deployments.size) {
      const owned = await this.db.query<{ id: string }>(
        "SELECT id FROM ai_robot_deployments WHERE vpbx_user_uid = :userUid AND id IN (:ids) AND status = 'ready' AND active_version_id IS NOT NULL",
        { replacements: { userUid, ids: [...deployments] }, type: QueryTypes.SELECT },
      );
      if (owned.length !== deployments.size) throw new BadRequestException({ code: 'AC_ROBOT_NOT_READY', message: 'AI deployment must be ready and owned by this tenant' });
    }
  }

  async check(userUid: number, campaignUid: number): Promise<IAutodialPreflight> {
    const campaign = await this.campaigns.findOne(userUid, campaignUid);
    return this.inspect(userUid, campaign);
  }

  async checkDraft(userUid: number, input: CreateAutodialCampaignDto): Promise<IAutodialPreflight> {
    const pacing = normalizeAutodialPacing(input.pacing);
    return this.inspect(userUid, {
      ...input, uid: 0, user_uid: userUid, revision: 0, status: 'draft',
      dial_mode: input.dial_mode ?? 'progressive', pacing,
      retry: normalizeAutodialRetry(input.retry), queue_names: queueNamesFromPacing(pacing),
      trunk_pool: toAutodialTrunkPool(input.trunk_pool ?? []), cid_policy: { ...defaultAutodialCidPolicy(), ...input.cid_policy },
      scenario_actions: (input.scenario_actions ?? []) as IRouteAction[], amd: { ...defaultAutodialAmd(), ...input.amd },
      success_min_sec: input.success_min_sec ?? 15, dial_timeout_sec: input.dial_timeout_sec ?? 45,
      schedules: (input.schedules ?? []).map((schedule, index) => ({ ...schedule, uid: index, campaign_uid: 0,
        weekday: schedule.weekday ?? null, date_from: schedule.date_from ?? null, date_to: schedule.date_to ?? null,
        enabled: schedule.enabled ?? true, timezone: schedule.timezone ?? 'Europe/Moscow' })),
    });
  }

  private async inspect(userUid: number, campaign: IAutodialCampaign & { schedules: IAutodialSchedule[] }): Promise<IAutodialPreflight> {
    const campaignUid = campaign.uid;
    const checks: IAutodialPreflightCheck[] = [];
    const add = (id: string, ok: boolean, code: string, detail?: string) => checks.push({ id, status: ok ? 'pass' : 'fail', code, detail });
    try { await this.validateDraft(userUid, campaign); add('configuration', true, 'configuration_valid'); }
    catch (error) {
      const response = (error as { response?: { code?: string; message?: string } }).response;
      add('configuration', false, response?.code ?? 'configuration_invalid', response?.message ?? 'Configuration could not be verified');
    }
    add('trunk_pool', campaign.trunk_pool.length > 0, campaign.trunk_pool.length ? 'trunk_configured' : 'AC_NO_TRUNK');
    add('scenario', campaign.scenario_actions.some((action) => action.enabled !== false), 'scenario_configured');
    if (campaign.scenario_actions.some((action) => action.enabled !== false && action.type === 'text2speech' && !action.params?.onFailure)) {
      checks.push({ id: 'speech_failure_policy', status: 'warning', code: 'tts_failure_policy_legacy' });
    }
    add('ari', this.ari.isConnected(), 'ari_connected');
    add('ami', this.ami.isConnected(), 'ami_connected');
    if (campaignUid) add('applied_revision', !campaign.apply_error && campaign.applied_revision === campaign.revision,
      campaign.apply_error ? 'dialplan_apply_failed' : campaign.applied_revision === campaign.revision ? 'dialplan_applied' : 'dialplan_revision_pending');
    if (campaign.amd?.enabled) {
      try {
        await this.dialplan.assertAmdReady({ amd: campaign.amd, user_uid: userUid });
        add('amd', true, 'amd_available');
      } catch { add('amd', false, 'AC_AMD_UNAVAILABLE'); }
    }
    const ids = campaign.trunk_pool.map((trunk) => trunk.trunk_id);
    if (ids.length) {
      const registrations = await this.db.query<{ id: string }>('SELECT r.id FROM ps_registrations r JOIN ps_endpoints e ON e.id = r.id WHERE r.id IN (:ids) AND e.tenantid = :tenantId', {
        replacements: { ids, tenantId: String(userUid) }, type: QueryTypes.SELECT,
      });
      if (registrations.length && this.ami.isConnected()) {
        try {
          const live = await this.ami.pjsipShowRegistrations();
          for (const registration of registrations) {
            const row = live.events.find((event) => String(event.objectname ?? event.ObjectName) === registration.id);
            const registered = live.complete && String(row?.status ?? row?.Status).toLowerCase() === 'registered';
            add(`registration:${registration.id}`, registered, registered ? 'trunk_registered' : 'trunk_not_registered');
          }
        } catch { add('registrations', false, 'registration_unknown'); }
      }
    }
    const [eligible] = await this.db.query<{ count: number | string }>(`
      SELECT COUNT(DISTINCT p.canonical_phone) AS count FROM ac_contact_phones p
      JOIN ac_contacts c ON c.uid = p.contact_uid
      WHERE p.base_uid = :baseUid AND c.vpbx_user_uid = :userUid AND p.canonical_phone <> ''
        AND NOT EXISTS (SELECT 1 FROM ac_dnc d WHERE d.vpbx_user_uid = :userUid AND d.normalized_phone = p.canonical_phone
          AND (d.expires_at IS NULL OR d.expires_at > :now)
          AND (d.scope = 'global' OR (d.scope = 'base' AND d.scope_uid = :baseUid) OR (d.scope = 'campaign' AND d.scope_uid = :campaignUid)))`,
    { replacements: { userUid, baseUid: campaign.base_uid, campaignUid, now: autodialSqlDate(new Date(), this.db) }, type: QueryTypes.SELECT });
    add('contacts', Number(eligible.count) > 0, 'contacts_after_dnc');
    let draftScheduleOpen = false;
    try { draftScheduleOpen = campaignWindowOpen(campaign.schedules, new Date()); } catch { /* Configuration check reports invalid schedules. */ }
    const diagnosis = campaignUid ? await this.diagnosis.diagnose(userUid, campaignUid) : {
      campaign_uid: 0, status: 'draft' as const, revision: 0, checked_at: new Date().toISOString(), reasons: [],
      schedule_open: draftScheduleOpen, ready_agents: 0, ready_tasks: 0,
      waiting_tasks: 0, next_attempt_at: null, active_channels: 0, runtime: null,
    };
    if (!diagnosis.schedule_open) checks.push({ id: 'schedule', status: 'warning', code: 'outside_schedule' });
    if (campaign.dial_mode !== 'agentless' && !diagnosis.ready_agents) checks.push({ id: 'agents', status: 'warning', code: campaignUid ? 'no_ready_agents' : 'agents_checked_on_save' });
    return { campaign_uid: campaignUid, revision: campaign.revision, checked_at: diagnosis.checked_at,
      ready: checks.every((check) => check.status !== 'fail'), eligible_numbers: Number(eligible.count), checks, diagnosis };
  }

  async assertReady(userUid: number, campaignUid: number): Promise<void> {
    const preflight = await this.check(userUid, campaignUid);
    if (!preflight.ready) throw new BadRequestException({ code: 'AC_PREFLIGHT_FAILED', message: 'Resolve blocking checks before starting', preflight });
  }
}
