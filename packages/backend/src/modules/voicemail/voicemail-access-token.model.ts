import { Column, DataType, Model, Table } from 'sequelize-typescript';

/**
 * Opaque 7-day play token for notify links (D-59 / D-67).
 * Validated by VoicemailLinkGuard — NOT JWT. Separate table from cc_display_tokens.
 */
@Table({ tableName: 'vm_access_tokens', timestamps: false, freezeTableName: true })
export class VoicemailAccessToken extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
  declare uid: number;

  /** Opaque hex string (NOT JWT) — 64 chars from randomBytes(32). */
  @Column({ type: DataType.STRING(64), allowNull: false })
  declare token: string;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare message_uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare vpbx_user_uid: number;

  @Column({ type: DataType.DATE, allowNull: false })
  declare expires_at: Date;

  /** Revocation stamp; NULL = active. */
  @Column({ type: DataType.DATE, allowNull: true })
  declare revoked_at: Date | null;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare created_at: Date;
}
