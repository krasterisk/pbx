import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UniqueConstraintError, type Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { randomUUID } from 'node:crypto';
import {
  AiIdempotency, AiJob, AiJobEvent, AiJobStage, AiOutbox,
} from './ai-job.models';
import { canonicalRequestHash, digestIdempotencyKey } from './idempotency';
import { admittedJobPayload } from './outbox-payload';
import {
  DEFAULT_QUEUE_CAP, DEFAULT_RUNNING_CAP, type FairnessCaps, assertFairness,
} from './fairness';
import type { AdmissionReceipt, AdmissionRequest } from './admission';

@Injectable()
export class AiJobAdmissionService {
  constructor(
    private readonly sequelize: Sequelize,
    @InjectModel(AiIdempotency) private readonly idempotency: typeof AiIdempotency,
    @InjectModel(AiJob) private readonly jobs: typeof AiJob,
    @InjectModel(AiJobStage) private readonly stages: typeof AiJobStage,
    @InjectModel(AiOutbox) private readonly outbox: typeof AiOutbox,
    @InjectModel(AiJobEvent) private readonly events: typeof AiJobEvent,
  ) {}

  async admit(input: AdmissionRequest, transaction?: Transaction): Promise<AdmissionReceipt> {
    if (transaction) return this.admitLocked(input, transaction);
    return this.sequelize.transaction((tx) => this.admitLocked(input, tx));
  }

  private async admitLocked(input: AdmissionRequest, transaction: Transaction): Promise<AdmissionReceipt> {
    if (!input.entitled) {
      throw Object.assign(new Error('product is not entitled'), { code: 'product_not_entitled', status: 403 });
    }
    const keyDigest = digestIdempotencyKey(input.idempotencyKey);
    const requestHash = canonicalRequestHash(input.request);
    const namespace = `jobs.create:${input.resourceKind}`;
    const existing = await this.idempotency.findOne({
      where: {
        tenant_uid: input.tenantUid,
        stable_principal_id: input.principalId,
        operation_namespace: namespace,
        key_digest: keyDigest,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (existing) {
      return this.replay(existing, requestHash);
    }
    const caps: FairnessCaps = input.caps ?? {
      runningCap: DEFAULT_RUNNING_CAP, queueCap: DEFAULT_QUEUE_CAP,
    };
    const tenantJobs = await this.jobs.findAll({
      where: { tenant_uid: input.tenantUid, state: ['queued', 'running'] },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    assertFairness({
      running: tenantJobs.filter(job => job.state === 'running').length,
      queued: tenantJobs.filter(job => job.state === 'queued').length,
    }, caps);
    const jobId = randomUUID();
    const now = input.now;
    const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    try {
      await this.idempotency.create({
        tenant_uid: input.tenantUid,
        stable_principal_id: input.principalId,
        operation_namespace: namespace,
        key_digest: keyDigest,
        request_hash: requestHash,
        state: 'started',
        resource_id: null,
        response_status: null,
        safe_response: '{}',
        expires_at: expires,
        created_at: now,
        updated_at: now,
      }, { transaction });
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        const raced = await this.idempotency.findOne({
          where: {
            tenant_uid: input.tenantUid,
            stable_principal_id: input.principalId,
            operation_namespace: namespace,
            key_digest: keyDigest,
          },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!raced) throw error;
        return this.replay(raced, requestHash);
      }
      throw error;
    }
    await this.jobs.create({
      id: jobId,
      tenant_uid: input.tenantUid,
      product: input.product,
      kind: input.kind,
      resource_kind: input.resourceKind,
      resource_id: input.resourceId,
      state: 'queued',
      priority: 0,
      admitted_at: now,
      version: 1,
      idempotency_principal_id: input.principalId,
      idempotency_namespace: namespace,
      idempotency_key_digest: keyDigest,
      created_at: now,
      updated_at: now,
    }, { transaction });
    await this.stages.create({
      id: randomUUID(),
      tenant_uid: input.tenantUid,
      job_id: jobId,
      stage_key: 'run',
      state: 'pending',
      attempt_count: 0,
      fence: 0,
      version: 1,
      created_at: now,
      updated_at: now,
    }, { transaction });
    const payload = admittedJobPayload(input.tenantUid, jobId);
    await this.outbox.create({
      id: randomUUID(),
      tenant_uid: input.tenantUid,
      aggregate_kind: payload.aggregateKind,
      aggregate_id: jobId,
      aggregate_version: 1,
      event_type: payload.eventType,
      schema_version: payload.schemaVersion,
      payload: JSON.stringify(payload),
      available_at: now,
      fence: 0,
      attempts: 0,
      version: 1,
      created_at: now,
    }, { transaction });
    await this.events.create({
      id: randomUUID(),
      tenant_uid: input.tenantUid,
      job_id: jobId,
      event_type: 'job.admitted',
      from_state: null,
      to_state: 'queued',
      actor: 'admission',
      occurred_at: now,
    }, { transaction });
    await this.idempotency.update({
      state: 'completed',
      resource_id: jobId,
      response_status: 202,
      safe_response: JSON.stringify({ jobId }),
      updated_at: now,
    }, {
      where: {
        tenant_uid: input.tenantUid,
        stable_principal_id: input.principalId,
        operation_namespace: namespace,
        key_digest: keyDigest,
      },
      transaction,
    });
    return { status: 202, jobId, replay: false };
  }

  private replay(existing: AiIdempotency, requestHash: string): AdmissionReceipt {
    if (existing.request_hash !== requestHash) {
      throw Object.assign(new Error('Idempotency-Key reused with a different request'), {
        code: 'idempotency_conflict', status: 409,
      });
    }
    if (existing.state !== 'completed' || !existing.resource_id) {
      throw Object.assign(new Error('idempotency row is incomplete'), {
        code: 'idempotency_in_progress', status: 503,
      });
    }
    return { status: 202, jobId: existing.resource_id, replay: true };
  }
}
