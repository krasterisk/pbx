import { BadRequestException, ForbiddenException, HttpException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { QueryTypes, type Transaction } from 'sequelize';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ModulesRegistryService } from '../cloud-admin/modules-registry.service';
import { autodialSqlDate } from '../autodial/autodial-sql-time.util';

export const AUTODIAL_INTEGRATION_SCOPES = ['autodial:read', 'autodial:contacts:write', 'autodial:imports:write',
  'autodial:dnc:write', 'autodial:proposals:write', 'autodial:webhooks:write'] as const;
export type AutodialIntegrationScope = typeof AUTODIAL_INTEGRATION_SCOPES[number];
const createSchema = z.strictObject({ label: z.string().trim().min(1).max(120),
  scopes: z.array(z.enum(AUTODIAL_INTEGRATION_SCOPES)).min(1).max(6), expires_at: z.iso.datetime() });
const hash = (token: string) => createHash('sha256').update('autodial-integration-v1\0').update(token).digest('hex');
interface KeyRow { uid: string; vpbx_user_uid: number; created_by: number; scopes: string[] | string;
  expires_at: Date; revoked_at: Date | null; rate_window: string | number; rate_count: number; level: number }
export interface AutodialKeyActor { sub: number; level: number; vpbx_user_uid: number; integration_key_uid: string; integration_scopes: string[] }

@Injectable()
export class AutodialIntegrationKeyService {
  constructor(@InjectConnection() private readonly db: Sequelize, private readonly modules: ModulesRegistryService) {}
  private admin(role: number): void { if (![0, 1].includes(role)) throw new ForbiddenException({ code: 'AC_API_ADMIN_REQUIRED' }); }
  async list(tenant: number, role: number) {
    this.admin(role);
    const rows = await this.db.query<{ scopes: string[] | string }>(`SELECT uid, label, scopes, expires_at, revoked_at, created_at FROM ac_integration_keys
      WHERE vpbx_user_uid = :tenant ORDER BY created_at DESC`, { replacements: { tenant }, type: QueryTypes.SELECT });
    return rows.map((row) => ({ ...row, scopes: typeof row.scopes === 'string' ? JSON.parse(row.scopes) as string[] : row.scopes }));
  }
  async create(tenant: number, actor: number, role: number, raw: unknown) {
    this.admin(role); const parsed = createSchema.safeParse(raw);
    if (!parsed.success || Date.parse(parsed.data.expires_at) <= Date.now() || Date.parse(parsed.data.expires_at) > Date.now() + 366 * 86400000)
      throw new BadRequestException({ code: 'AC_API_KEY_INPUT' });
    const token = 'krac_v1_' + randomBytes(32).toString('base64url'), uid = randomUUID();
    await this.db.transaction(async (transaction) => {
      // Serialize key issuance across workers without locking another initiative's tables.
      const users = await this.db.query('SELECT uniqueid FROM users WHERE uniqueid = :actor AND vpbx_user_uid = :tenant AND level IN (0, 1) FOR UPDATE',
        { replacements: { actor, tenant }, type: QueryTypes.SELECT, transaction });
      if (!users.length) throw new ForbiddenException({ code: 'AC_API_ADMIN_REQUIRED' });
      const [count] = await this.db.query<{ total: string | number }>('SELECT COUNT(*) AS total FROM ac_integration_keys WHERE vpbx_user_uid = :tenant AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP',
        { replacements: { tenant }, type: QueryTypes.SELECT, transaction });
      if (Number(count.total) >= 20) throw new BadRequestException({ code: 'AC_API_KEY_LIMIT' });
      await this.db.query(`INSERT INTO ac_integration_keys (uid, vpbx_user_uid, created_by, label, secret_hash, scopes, expires_at, created_at)
        VALUES (:uid, :tenant, :actor, :label, :hash, :scopes, :expires, :now)`, { replacements: { uid, tenant, actor,
          label: parsed.data.label, hash: hash(token), scopes: JSON.stringify([...new Set(parsed.data.scopes)]),
          expires: autodialSqlDate(new Date(parsed.data.expires_at), this.db), now: autodialSqlDate(new Date(), this.db) }, transaction });
    });
    return { uid, token, label: parsed.data.label, scopes: [...new Set(parsed.data.scopes)], expires_at: parsed.data.expires_at };
  }
  async revoke(tenant: number, role: number, uid: string) {
    this.admin(role);
    if (!z.uuid().safeParse(uid).success) throw new BadRequestException({ code: 'AC_API_KEY_INPUT' });
    const rows = await this.db.query('SELECT uid FROM ac_integration_keys WHERE uid = :uid AND vpbx_user_uid = :tenant',
      { replacements: { uid, tenant }, type: QueryTypes.SELECT });
    if (!rows.length) throw new NotFoundException({ code: 'AC_API_KEY_NOT_FOUND' });
    await this.db.query('UPDATE ac_integration_keys SET revoked_at = CURRENT_TIMESTAMP WHERE uid = :uid AND vpbx_user_uid = :tenant', { replacements: { uid, tenant } });
    return { revoked: true };
  }
  async authenticate(token: string): Promise<AutodialKeyActor> {
    if (!/^krac_v1_[A-Za-z0-9_-]{43}$/.test(token)) throw new UnauthorizedException();
    const actor = await this.db.transaction(async (transaction) => {
      const [row] = await this.db.query<KeyRow>(`SELECT k.*, u.level FROM ac_integration_keys k JOIN users u
        ON u.uniqueid = k.created_by AND u.vpbx_user_uid = k.vpbx_user_uid WHERE k.secret_hash = :hash FOR UPDATE`,
        { replacements: { hash: hash(token) }, type: QueryTypes.SELECT, transaction });
      if (!row || row.revoked_at || new Date(row.expires_at).getTime() <= Date.now() || ![0, 1].includes(Number(row.level)))
        throw new UnauthorizedException();
      const window = Math.floor(Date.now() / 60000), count = Number(row.rate_window) === window ? row.rate_count + 1 : 1;
      if (count > 60) throw new HttpException({ code: 'AC_API_RATE_LIMIT', retry_after_sec: 60 }, 429);
      await this.db.query('UPDATE ac_integration_keys SET rate_window = :window, rate_count = :count WHERE uid = :uid',
        { replacements: { window, count, uid: row.uid }, transaction });
      let scopes: unknown; try { scopes = typeof row.scopes === 'string' ? JSON.parse(row.scopes) : row.scopes; } catch { throw new UnauthorizedException(); }
      if (!Array.isArray(scopes) || scopes.some((scope) => !AUTODIAL_INTEGRATION_SCOPES.includes(scope))) throw new UnauthorizedException();
      return { sub: row.created_by, level: Number(row.level), vpbx_user_uid: row.vpbx_user_uid,
        integration_key_uid: row.uid, integration_scopes: scopes as string[] };
    });
    if (!await this.modules.tenantHasModule(actor.vpbx_user_uid, 'autodial')) throw new ForbiddenException({ code: 'AC_API_MODULE_DISABLED' });
    return actor;
  }

  async assertActive(uid: string, tenant: number, scope: AutodialIntegrationScope, transaction: Transaction): Promise<void> {
    const [row] = await this.db.query<KeyRow>(`SELECT k.*, u.level FROM ac_integration_keys k JOIN users u
      ON u.uniqueid = k.created_by AND u.vpbx_user_uid = k.vpbx_user_uid WHERE k.uid = :uid AND k.vpbx_user_uid = :tenant`,
      { replacements: { uid, tenant }, type: QueryTypes.SELECT, transaction });
    let scopes: unknown; try { scopes = typeof row?.scopes === 'string' ? JSON.parse(row.scopes) : row?.scopes; } catch { scopes = []; }
    if (!row || row.revoked_at || new Date(row.expires_at).getTime() <= Date.now() || ![0, 1].includes(Number(row.level))
      || !Array.isArray(scopes) || !scopes.includes(scope)) throw new ForbiddenException({ code: 'AC_API_KEY_INACTIVE' });
    if (!await this.modules.tenantHasModule(tenant, 'autodial')) throw new ForbiddenException({ code: 'AC_API_MODULE_DISABLED' });
  }
}
