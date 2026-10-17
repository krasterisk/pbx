import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/sequelize';
import { Interval } from '@nestjs/schedule';
import { Sequelize } from 'sequelize-typescript';
import { QueryTypes, Transaction } from 'sequelize';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requireJwtSecret } from '../auth/jwt-secret';
import { AutodialIntegrationKeyService, type AutodialKeyActor } from '../autodial-integration/autodial-integration-key.service';
import { autodialSqlDate } from './autodial-sql-time.util';
import { autodialWebhookUrl, sendAutodialWebhook } from './autodial-webhook-http';

@Injectable()
export class AutodialWebhooksService {
  private working = false;
  constructor(@InjectConnection() private readonly db: Sequelize, private readonly config: ConfigService,
    private readonly keys: AutodialIntegrationKeyService) {}
  private encryptionKey() { return createHash('sha256').update('autodial-webhook-v1\0').update(requireJwtSecret(this.config)).digest(); }
  private encrypt(secret: string): string {
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv);
    const data = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), data].map((part) => part.toString('base64url')).join('.');
  }
  private decrypt(value: string): string {
    const [iv, tag, data] = value.split('.').map((part) => Buffer.from(part, 'base64url'));
    const cipher = createDecipheriv('aes-256-gcm', this.encryptionKey(), iv); cipher.setAuthTag(tag);
    return Buffer.concat([cipher.update(data), cipher.final()]).toString('utf8');
  }
  async list(actor: AutodialKeyActor) {
    return this.db.query(`SELECT uid, url, enabled, created_at FROM ac_webhooks WHERE vpbx_user_uid = :tenant AND key_uid = :key ORDER BY created_at DESC`,
      { replacements: { tenant: actor.vpbx_user_uid, key: actor.integration_key_uid }, type: QueryTypes.SELECT });
  }
  async create(actor: AutodialKeyActor, raw: unknown) {
    const input = z.strictObject({ url: z.string().min(1).max(2048) }).safeParse(raw);
    if (!input.success) throw new BadRequestException({ code: 'AC_WEBHOOK_URL' });
    try { autodialWebhookUrl(input.data.url); } catch { throw new BadRequestException({ code: 'AC_WEBHOOK_URL' }); }
    const secret = randomBytes(32).toString('base64url'), uid = randomUUID();
    await this.db.transaction(async (transaction) => {
      await this.db.query('SELECT uid FROM ac_integration_keys WHERE uid = :key AND vpbx_user_uid = :tenant FOR UPDATE',
        { replacements: { key: actor.integration_key_uid, tenant: actor.vpbx_user_uid }, transaction, type: QueryTypes.SELECT });
      await this.keys.assertActive(actor.integration_key_uid, actor.vpbx_user_uid, 'autodial:webhooks:write', transaction);
      const rows = await this.db.query('SELECT uid FROM ac_webhooks WHERE vpbx_user_uid = :tenant AND enabled = TRUE',
        { replacements: { tenant: actor.vpbx_user_uid }, transaction, type: QueryTypes.SELECT });
      if (rows.length >= 10) throw new BadRequestException({ code: 'AC_WEBHOOK_LIMIT' });
      await this.db.query(`INSERT INTO ac_webhooks (uid, vpbx_user_uid, key_uid, url, secret_cipher, created_at)
        VALUES (:uid, :tenant, :key, :url, :secret, :now)`, { replacements: { uid, tenant: actor.vpbx_user_uid,
          key: actor.integration_key_uid, url: input.data.url, secret: this.encrypt(secret), now: autodialSqlDate(new Date(), this.db) }, transaction });
    });
    return { uid, url: input.data.url, secret, delivery: 'at-least-once', signature: 'HMAC-SHA256(timestamp + "." + rawBody)', max_attempts: 8 };
  }
  async disable(actor: AutodialKeyActor, uid: string) {
    if (!z.uuid().safeParse(uid).success) throw new BadRequestException({ code: 'AC_API_INPUT' });
    const rows = await this.db.query('SELECT uid FROM ac_webhooks WHERE uid = :uid AND vpbx_user_uid = :tenant AND key_uid = :key',
      { replacements: { uid, tenant: actor.vpbx_user_uid, key: actor.integration_key_uid }, type: QueryTypes.SELECT });
    if (!rows.length) throw new NotFoundException({ code: 'AC_WEBHOOK_NOT_FOUND' });
    await this.db.query('UPDATE ac_webhooks SET enabled = FALSE WHERE uid = :uid AND vpbx_user_uid = :tenant AND key_uid = :key',
      { replacements: { uid, tenant: actor.vpbx_user_uid, key: actor.integration_key_uid } }); return { disabled: true };
  }
  async deliveries(actor: AutodialKeyActor, uid: string) {
    if (!z.uuid().safeParse(uid).success) throw new BadRequestException({ code: 'AC_API_INPUT' });
    return this.db.query(`SELECT d.uid, d.event_key, d.status, d.attempt_count, d.next_attempt_at, d.response_status, d.completed_at
      FROM ac_webhook_deliveries d JOIN ac_webhooks w ON w.uid = d.webhook_uid AND w.vpbx_user_uid = d.vpbx_user_uid
      WHERE w.uid = :uid AND w.vpbx_user_uid = :tenant AND w.key_uid = :key ORDER BY d.created_at DESC LIMIT 100`,
      { replacements: { uid, tenant: actor.vpbx_user_uid, key: actor.integration_key_uid }, type: QueryTypes.SELECT });
  }

  async enqueueAttempt(tenant: number, attemptUid: number, transaction: Transaction): Promise<void> {
    const hooks = await this.db.query<{ uid: string }>('SELECT uid FROM ac_webhooks WHERE vpbx_user_uid = :tenant AND enabled = TRUE',
      { replacements: { tenant }, transaction, type: QueryTypes.SELECT });
    if (!hooks.length) return;
    const [result] = await this.db.query<Record<string, unknown>>(`SELECT a.uid AS attempt_uid, a.campaign_uid, a.attempt_no, a.tour_no,
      a.disposition, a.started_at, a.ended_at, a.talk_sec, a.scenario_result, c.external_id FROM ac_attempts a
      JOIN ac_tasks t ON t.uid = a.task_uid AND t.vpbx_user_uid = a.vpbx_user_uid
      JOIN ac_contacts c ON c.uid = t.contact_uid AND c.vpbx_user_uid = a.vpbx_user_uid
      WHERE a.uid = :attempt AND a.vpbx_user_uid = :tenant`, { replacements: { tenant, attempt: attemptUid }, transaction, type: QueryTypes.SELECT });
    if (!result || !result.ended_at) return;
    const eventKey = `attempt:${attemptUid}:` + createHash('sha256').update(JSON.stringify(result)).digest('hex').slice(0, 24);
    const payload = JSON.stringify({ schema_version: 1, event_id: eventKey, type: 'autodial.attempt.completed', data: result });
    const pg = this.db.getDialect() === 'postgres';
    for (const hook of hooks) await this.db.query(`${pg ? 'INSERT' : 'INSERT IGNORE'} INTO ac_webhook_deliveries
      (uid, webhook_uid, vpbx_user_uid, event_key, payload, next_attempt_at, created_at)
      VALUES (:uid, :hook, :tenant, :event, :payload, :now, :now) ${pg ? 'ON CONFLICT (webhook_uid, event_key) DO NOTHING' : ''}`,
      { replacements: { uid: randomUUID(), hook: hook.uid, tenant, event: eventKey, payload, now: autodialSqlDate(new Date(), this.db) }, transaction });
  }

  @Interval(2000)
  async deliverNext(): Promise<void> {
    if (this.working) return; this.working = true;
    try {
      await this.db.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED }, async (transaction) => {
        const [delivery] = await this.db.query<{ uid: string; payload: unknown; attempt_count: number; vpbx_user_uid: number; webhook_uid: string }>(
          "SELECT * FROM ac_webhook_deliveries WHERE status = 'pending' AND next_attempt_at <= CURRENT_TIMESTAMP ORDER BY next_attempt_at LIMIT 1 FOR UPDATE SKIP LOCKED",
          { transaction, type: QueryTypes.SELECT });
        if (!delivery) return;
        const [hook] = await this.db.query<{ enabled: boolean; key_uid: string; url: string; secret_cipher: string }>(
          'SELECT * FROM ac_webhooks WHERE uid = :uid AND vpbx_user_uid = :tenant', { replacements: { uid: delivery.webhook_uid, tenant: delivery.vpbx_user_uid }, transaction, type: QueryTypes.SELECT });
        let status = 0, inactive = !hook?.enabled;
        if (hook?.enabled) {
          try { await this.keys.assertActive(hook.key_uid, delivery.vpbx_user_uid, 'autodial:webhooks:write', transaction); }
          catch { inactive = true; }
          if (!inactive) try {
            const body = typeof delivery.payload === 'string' ? delivery.payload : JSON.stringify(delivery.payload);
            const timestamp = String(Math.floor(Date.now() / 1000));
            const signature = createHmac('sha256', this.decrypt(hook.secret_cipher)).update(`${timestamp}.${body}`).digest('hex');
            status = await sendAutodialWebhook(hook.url, body, { 'X-Krasterisk-Event-Id': delivery.uid,
              'X-Krasterisk-Timestamp': timestamp, 'X-Krasterisk-Signature': `sha256=${signature}` });
          } catch { status = 0; }
        }
        const count = delivery.attempt_count + 1, success = status >= 200 && status < 300;
        const state = inactive ? 'cancelled' : success ? 'delivered' : count >= 8 ? 'failed' : 'pending';
        await this.db.query(`UPDATE ac_webhook_deliveries SET status = :state, attempt_count = :count,
          response_status = :status, next_attempt_at = :next, completed_at = :completed WHERE uid = :uid`,
          { replacements: { uid: delivery.uid, state, count, status: status || null,
            next: autodialSqlDate(new Date(Date.now() + Math.min(3600000, 30000 * 2 ** (count - 1))), this.db),
            completed: state === 'pending' ? null : autodialSqlDate(new Date(), this.db) }, transaction });
      });
    } catch { /* A failed DB transaction keeps the durable delivery pending. Never log payloads/secrets. */ }
    finally { this.working = false; }
  }
}
