import { Column, DataType, Model, Table } from 'sequelize-typescript';

/**
 * Long-lived opaque display token for TV wallboard access (D-26).
 * Validated by DisplayTokenGuard — NOT JWT. Revocable via revoked_at.
 */
@Table({ tableName: 'cc_display_tokens', timestamps: false })
export class CcDisplayToken extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
  declare uid: number;

  /** Opaque hex string (NOT JWT) — 64 chars from randomBytes(32). */
  @Column({ type: DataType.STRING(64), allowNull: false })
  declare token: string;

  /** Human-readable label ("Приёмная TV", etc.). */
  @Column({ type: DataType.STRING(128), allowNull: true })
  declare label: string | null;

  /** Supervisor user id who created the token (audit). */
  @Column({ type: DataType.INTEGER, allowNull: true })
  declare created_by: number | null;

  /** Optional expiry; NULL = no expiry. */
  @Column({ type: DataType.DATE, allowNull: true })
  declare expires_at: Date | null;

  /** Revocation stamp; NULL = active. */
  @Column({ type: DataType.DATE, allowNull: true })
  declare revoked_at: Date | null;

  /** Updated by DisplayTokenGuard on successful SSE connect (audit). */
  @Column({ type: DataType.DATE, allowNull: true })
  declare last_used_at: Date | null;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare created_at: Date;

  // Tenant isolation
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;
}
