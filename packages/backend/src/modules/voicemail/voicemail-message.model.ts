import { Column, DataType, Model, Table } from 'sequelize-typescript';
import type { NotifyStatus, TranscriptStatus } from '@krasterisk/shared';

@Table({ tableName: 'voicemail_messages', timestamps: false, freezeTableName: true })
export class VoicemailMessage extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
  declare uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;

  @Column({ type: DataType.STRING(128), allowNull: false })
  declare uniqueid: string;

  @Column({ type: DataType.STRING(512), allowNull: false })
  declare file_rel: string;

  @Column({ type: DataType.STRING(32), allowNull: false, defaultValue: '' })
  declare record_status: string;

  @Column({ type: DataType.STRING(64), allowNull: false, defaultValue: '' })
  declare caller_id: string;

  @Column({ type: DataType.STRING(64), allowNull: false, defaultValue: '' })
  declare exten: string;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare duration_sec: number | null;

  @Column({ type: DataType.STRING(16), allowNull: false, defaultValue: 'pending' })
  declare notify_status: NotifyStatus;

  @Column({ type: DataType.STRING(16), allowNull: false, defaultValue: 'pending' })
  declare transcript_status: TranscriptStatus;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare notify_attempts: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare transcript_attempts: number;

  @Column({ type: DataType.DATE, allowNull: true })
  declare next_notify_at: Date | null;

  @Column({ type: DataType.DATE, allowNull: true })
  declare scan_locked_until: Date | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare transcript: string | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare summary: string | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare notify_error: string | null;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare created_at: Date;
}
