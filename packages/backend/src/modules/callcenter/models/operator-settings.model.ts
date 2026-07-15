import { Column, DataType, Model, Table } from 'sequelize-typescript';

/**
 * Per-operator call-center settings (D-16/18/19/20 → D-22).
 * Unique per (vpbx_user_uid, operator_user_id).
 */
@Table({ tableName: 'cc_operator_settings', timestamps: false })
export class CcOperatorSettings extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
  declare uid: number;

  /** User.id of the operator who owns these settings. */
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare operator_user_id: number;

  /** D-18: allow call pickup from own queues. */
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  declare pickup_enabled: boolean;

  /** D-16: auto-answer incoming queue calls. */
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  declare auto_answer: boolean;

  /** D-16: play zip tone before connecting on auto-answer. */
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare auto_answer_zip_tone: boolean;

  /** D-19: final wrap-up timeout in seconds. */
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 30 })
  declare wrapup_timeout: number;

  /** D-19: wrap-up extend button step (+N sec). */
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 30 })
  declare wrapup_extend_step: number;

  /** D-19: autosave draft card on wrap-up timeout → READY. */
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare wrapup_autosave_draft: boolean;

  /** D-20: sound for incoming call. */
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare sound_incoming: boolean;

  /** D-20: sound for missed/abandoned call. */
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare sound_missed: boolean;

  /** D-20: Browser Notification when tab is inactive. */
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare notifications_enabled: boolean;

  /** D-20: notification volume 0–100. */
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 100 })
  declare volume: number;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare updated_at: Date;

  // Tenant isolation
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;
}
