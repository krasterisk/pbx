import { Column, DataType, Model, Table } from 'sequelize-typescript';

export type ConferenceGuestTokenKind = 'shared_link' | 'named_invite';

/**
 * Opaque hex invite token (NOT JWT). Tenant scope arrives via room_uid FK cascade.
 */
@Table({ tableName: 'conference_guest_tokens', timestamps: false, freezeTableName: true })
export class ConferenceGuestToken extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
  declare uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare room_uid: number;

  /** Opaque hex, NOT JWT — 64 chars from randomBytes(32). */
  @Column({ type: DataType.STRING(64), allowNull: false })
  declare token: string;

  @Column({
    type: DataType.ENUM('shared_link', 'named_invite'),
    allowNull: false,
  })
  declare kind: ConferenceGuestTokenKind;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare invite_name: string | null;

  @Column({ type: DataType.DATE, allowNull: true })
  declare expires_at: Date | null;

  @Column({ type: DataType.DATE, allowNull: true })
  declare revoked_at: Date | null;

  @Column({ type: DataType.DATE, allowNull: true })
  declare last_used_at: Date | null;

  @Column({ type: DataType.STRING(64), allowNull: true })
  declare display_name: string | null;

  @Column({ type: DataType.STRING(64), allowNull: true })
  declare sip_id: string | null;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare created_at: Date;
}
