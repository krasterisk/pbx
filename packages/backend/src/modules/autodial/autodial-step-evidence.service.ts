import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { QueryTypes, Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { AUTODIAL_SUPPORTED_ACTIONS } from '@krasterisk/shared';
import { AmiService } from '../ami/ami.service';
import { readAutodialTestJson } from './autodial-test-snapshot.util';
import { autodialCompletionOutcomeSchema } from '@krasterisk/shared';
import { stampAutodialOutcome } from './autodial-outcome-evidence.util';
import { parseAutodialChannelId } from './autodial-phone.util';

/** Persists PBX observations against the immutable admitted step, never the
 * current campaign definition. Lost events remain unconfirmed. */
@Injectable()
export class AutodialStepEvidenceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AutodialStepEvidenceService.name);
  private unsubscribe?: () => void;
  private readonly pending = new Map<string, Promise<void>>();
  constructor(private readonly ami: AmiService, @InjectConnection() private readonly db: Sequelize) {}

  onModuleInit() {
    this.unsubscribe = this.ami.subscribeInternalEvents((raw) => {
      const event = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key.toLowerCase(), value]));
      const connection = String(event.event).toLowerCase() === 'agentconnect';
      if (!connection && (String(event.event).toLowerCase() !== 'userevent'
        || !['AutodialStep', 'AutodialStepResult'].includes(String(event.userevent)))) return;
      const key = connection ? `connection:${event.uniqueid}` : `${event.tenant}:${event.test || event.attempt}`;
      if (this.pending.size >= 1000 && !this.pending.has(key)) return; // Unknown facts never become a success.
      const next = (this.pending.get(key) ?? Promise.resolve()).catch(() => undefined)
        .then(() => connection ? this.recordAgentConnection(event) : this.record(event));
      this.pending.set(key, next);
      void next.catch(() => this.logger.warn('Autodial step evidence could not be persisted')).finally(() => {
        if (this.pending.get(key) === next) this.pending.delete(key);
      });
    });
  }
  async onModuleDestroy() { this.unsubscribe?.(); await Promise.allSettled(this.pending.values()); }

  /** Queue entry/AgentCalled are insufficient. AgentConnect is emitted only
   * after the queue bridges an answering member to our admitted caller. */
  async recordAgentConnection(event: Record<string, unknown>): Promise<void> {
    if (String(event.event).toLowerCase() !== 'agentconnect') return;
    const channel = String(event.uniqueid ?? ''), identity = parseAutodialChannelId(channel);
    const queue = String(event.queue ?? ''), agent = String(event.interface ?? '');
    if (!identity || !Object.values(identity).every((value) => Number.isSafeInteger(value) && value > 0)
      || !queue || queue.length > 128 || !/^(?:PJSIP|SIP|Local)\/[A-Za-z0-9_@./:+-]{1,200}$/.test(agent)) return;
    await this.db.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED }, async (transaction) => {
      const [attempt] = await this.db.query<{ uid: number; tenant: number; evidence: unknown }>(
        `SELECT uid, vpbx_user_uid AS tenant, scenario_result AS evidence FROM ac_attempts
         WHERE channel_id = :channel AND campaign_uid = :campaign AND task_uid = :task AND attempt_no = :attemptNo FOR UPDATE`,
        { replacements: { channel, campaign: identity.campaignUid, task: identity.taskUid, attemptNo: identity.attemptNo }, transaction, type: QueryTypes.SELECT });
      if (!attempt) return;
      const result = readAutodialTestJson(attempt.evidence) ?? {}, snapshot = readAutodialTestJson(result.snapshot);
      const admitted = Array.isArray(snapshot?.steps) ? snapshot.steps.find((step) => step?.type === 'toqueue'
        && step.status !== 'skipped' && step.queue_name === queue) : null;
      if (!admitted || result.operator_connection) return;
      const now = new Date().toISOString(), steps = readAutodialTestJson(result.steps) ?? {};
      result.operator_connection = { queue, interface: agent, connected_at: now, source: 'ami_agent_connect' };
      result.steps = { ...steps, [admitted.id]: { ...readAutodialTestJson(steps[admitted.id]), type: 'toqueue',
        status: 'completed', detail: 'AGENT_CONNECTED', completed_at: now } };
      const meaning = autodialCompletionOutcomeSchema.safeParse(admitted.connectionOutcome);
      if (meaning.success) { result.business_outcome = meaning.data.code; stampAutodialOutcome(result, snapshot); }
      await this.db.query(`UPDATE ac_attempts SET scenario_result = :result, queue_name = :queue, agent_interface = :agent
        WHERE uid = :uid AND vpbx_user_uid = :tenant`,
      { replacements: { result: JSON.stringify(result), queue, agent, uid: attempt.uid, tenant: attempt.tenant }, transaction, type: QueryTypes.UPDATE });
    });
  }

  async record(event: Record<string, unknown>): Promise<void> {
    const tenant = Number(event.tenant), attempt = Number(event.attempt), test = String(event.test ?? '');
    const type = String(event.type ?? ''), stepId = String(event.step ?? '').trim();
    const internal = /^[a-f0-9-]{36}$/.test(test);
    if (!Number.isSafeInteger(tenant) || tenant < 0 || !stepId || stepId.length > 128
      || !(AUTODIAL_SUPPORTED_ACTIONS as readonly string[]).includes(type)
      || !internal && (!Number.isSafeInteger(attempt) || attempt <= 0)) return;
    await this.db.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED }, async (transaction) => {
      const rows = await this.db.query<{ evidence: unknown; snapshot?: unknown }>(internal
        ? 'SELECT result_json AS evidence, snapshot_json AS snapshot FROM ac_test_calls WHERE uid = :uid AND vpbx_user_uid = :tenant FOR UPDATE'
        : 'SELECT scenario_result AS evidence FROM ac_attempts WHERE uid = :uid AND vpbx_user_uid = :tenant FOR UPDATE',
      { replacements: { uid: internal ? test : attempt, tenant }, transaction, type: QueryTypes.SELECT });
      if (!rows[0]) return;
      const result = readAutodialTestJson(rows[0].evidence) ?? {};
      const snapshot = readAutodialTestJson(internal ? rows[0].snapshot : result.snapshot);
      const admitted = Array.isArray(snapshot?.steps) ? snapshot.steps.find((value) => value && typeof value === 'object'
        && value.id === stepId && value.type === type && value.status !== 'skipped') : null;
      if (!admitted) return;
      const steps = readAutodialTestJson(result.steps) ?? {};
      if (!Object.hasOwn(steps, stepId) && Object.keys(steps).length >= 100) return;
      const previous = readAutodialTestJson(steps[stepId]) ?? {};
      const now = new Date().toISOString();
      let observation: Record<string, unknown>;
      if (event.userevent === 'AutodialStep') {
        // AgentConnect and step events use separate ingress queues. A delayed
        // queue-entry write must not erase an already observed bridge.
        const connected = type === 'toqueue' && previous.detail === 'AGENT_CONNECTED';
        observation = { ...previous, type, status: connected ? 'completed' : 'entered', entered_at: connected ? previous.entered_at ?? now : now,
          executions: Math.min(999, Number(previous.executions ?? 0) + 1) };
      } else {
        const status = String(event.status ?? '').toUpperCase();
        if (!/^[A-Z_]{1,40}$/.test(status)) return;
        const digits = /^[0-9*#A-D]{0,32}$/.test(String(event.digits ?? '')) ? String(event.digits ?? '') : '';
        const outcomes = readAutodialTestJson(admitted.outcomes) ?? {};
        const state = type === 'collect_input'
          ? status === 'TIMEOUT' || status === 'OK' && !digits ? 'no_input'
            : status !== 'OK' ? 'failed' : Object.keys(outcomes).length && !Object.hasOwn(outcomes, digits) ? 'invalid_input' : 'completed'
          : status === 'SUCCESS' ? 'completed' : 'failed';
        observation = { ...previous, type, status: state, completed_at: now, detail: status,
          ...(type === 'collect_input' ? { digits } : {}) };
        if (type === 'collect_input' && state === 'completed' && typeof outcomes[digits] === 'string') {
          result.business_outcome = outcomes[digits]; result.dtmf = digits;
        }
        if (['text2speech', 'playback'].includes(type)) result.delivery = state === 'failed' || result.delivery === 'playback_failed'
          ? 'playback_failed' : 'playback_completed';
        if (type === 'text2speech' && state === 'completed') {
          const completion = autodialCompletionOutcomeSchema.safeParse(admitted.completionOutcome);
          if (completion.success) result.business_outcome = completion.data.code;
        }
        if (result.business_outcome) stampAutodialOutcome(result, snapshot);
      }
      result.steps = { ...steps, [stepId]: observation };
      await this.db.query(internal
        ? 'UPDATE ac_test_calls SET result_json = :result WHERE uid = :uid AND vpbx_user_uid = :tenant'
        : 'UPDATE ac_attempts SET scenario_result = :result WHERE uid = :uid AND vpbx_user_uid = :tenant',
      { replacements: { uid: internal ? test : attempt, tenant, result: JSON.stringify(result) }, transaction, type: QueryTypes.UPDATE });
    });
  }
}
