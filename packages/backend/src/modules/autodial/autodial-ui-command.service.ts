import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { createHash } from 'node:crypto';
import { QueryTypes, Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { autodialSqlDate } from './autodial-sql-time.util';

type Operation = 'create_base' | 'create_campaign' | 'create_contact';
interface Command { operation: Operation; request_hash: string; resource_uid: number | null }

@Injectable()
export class AutodialUiCommandService {
  constructor(@InjectConnection() private readonly db: Sequelize) {}

  private identity(tenant: number, actor: number | undefined, key: unknown) {
    if (!Number.isSafeInteger(actor) || Number(actor) <= 0 || typeof key !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(key)) {
      throw new BadRequestException({ code: 'AC_UI_COMMAND_INPUT' });
    }
    return { tenant, actor: Number(actor), key };
  }

  async status(tenant: number, actor: number | undefined, key: unknown) {
    const replacements = this.identity(tenant, actor, key);
    const [command] = await this.db.query<Command>(`SELECT operation, request_hash, resource_uid FROM ac_ui_commands
      WHERE vpbx_user_uid = :tenant AND actor_uid = :actor AND request_id = :key`, { replacements, type: QueryTypes.SELECT });
    return command?.resource_uid ? { status: 'completed' as const, operation: command.operation, resource_uid: Number(command.resource_uid) }
      : { status: 'unknown' as const };
  }

  async run(tenant: number, actor: number | undefined, key: unknown, operation: Operation, payload: unknown,
    write: (transaction: Transaction) => Promise<{ uid: number }>): Promise<number> {
    const identity = this.identity(tenant, actor, key);
    const canonical = JSON.stringify(payload, (_key, value: unknown) => value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value);
    const hash = createHash('sha256').update(canonical).digest('hex');
    const replacements = { ...identity, operation, hash, now: autodialSqlDate(new Date(), this.db) };
    return this.db.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED }, async (transaction) => {
      // A competing INSERT waits for commit/rollback; SELECT then locks the same command.
      const onConflict = this.db.getDialect() === 'postgres'
        ? 'ON CONFLICT (vpbx_user_uid, actor_uid, request_id) DO NOTHING'
        : 'ON DUPLICATE KEY UPDATE request_id = request_id';
      await this.db.query(`INSERT INTO ac_ui_commands (vpbx_user_uid,actor_uid,request_id,operation,request_hash,resource_uid,created_at)
        VALUES (:tenant,:actor,:key,:operation,:hash,NULL,:now) ${onConflict}`, { replacements, transaction });
      const [command] = await this.db.query<Command>(`SELECT operation, request_hash, resource_uid FROM ac_ui_commands
        WHERE vpbx_user_uid = :tenant AND actor_uid = :actor AND request_id = :key FOR UPDATE`,
      { replacements, transaction, type: QueryTypes.SELECT });
      if (!command || command.operation !== operation || command.request_hash !== hash) {
        throw new ConflictException({ code: 'AC_UI_COMMAND_CONFLICT' });
      }
      if (command.resource_uid !== null) return Number(command.resource_uid);
      const created = await write(transaction);
      await this.db.query(`UPDATE ac_ui_commands SET resource_uid = :uid
        WHERE vpbx_user_uid = :tenant AND actor_uid = :actor AND request_id = :key`,
      { replacements: { ...identity, uid: created.uid }, transaction });
      return created.uid;
    });
  }
}
