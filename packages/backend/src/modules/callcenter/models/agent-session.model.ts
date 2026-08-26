import { Column, DataType, Model, Table } from 'sequelize-typescript';
import type { SoftphoneMode, ShiftCloseReason } from './shift-policy.types';

@Table({ tableName: 'cc_agent_sessions', timestamps: false })
export class CcAgentSession extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
  declare uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare user_id: number;

  @Column({ type: DataType.STRING(64), allowNull: false })
  declare agent_interface: string;

  @Column({ type: DataType.DATE, allowNull: true, defaultValue: DataType.NOW })
  declare login_time: Date;

  @Column({ type: DataType.DATE, allowNull: true })
  declare logout_time: Date;

  @Column({ type: DataType.INTEGER, allowNull: true, defaultValue: 0 })
  declare total_calls: number;

  /** Total talk time in seconds */
  @Column({ type: DataType.INTEGER, allowNull: true, defaultValue: 0 })
  declare total_talk_time: number;

  /** Total pause time in seconds */
  @Column({ type: DataType.INTEGER, allowNull: true, defaultValue: 0 })
  declare total_pause_time: number;

  /** Total idle (ready but not on call) time in seconds */
  @Column({ type: DataType.INTEGER, allowNull: true, defaultValue: 0 })
  declare total_idle_time: number;

  /** Last known AgentStatus snapshot (survives Nest restart). */
  @Column({ type: DataType.STRING(32), allowNull: true })
  declare last_status: string | null;

  /** Wall-clock when last_status was entered. */
  @Column({ type: DataType.DATE, allowNull: true })
  declare last_status_at: Date | null;

  /** Pause / outbound-work reason at last snapshot. */
  @Column({ type: DataType.STRING(128), allowNull: true })
  declare pause_reason: string | null;

  /**
   * Provenance of last_status (manual / policy / login / restore / …).
   * Used to decide whether panel may override Asterisk pause.
   */
  @Column({ type: DataType.STRING(16), allowNull: true })
  declare last_status_origin: string | null;

  /** Queues claimed at shift start (JSON string array). */
  @Column({ type: DataType.JSON, allowNull: true })
  declare queues_snapshot: string[] | null;

  /** Softphone mode chosen at login. */
  @Column({ type: DataType.STRING(16), allowNull: true })
  declare softphone_mode: SoftphoneMode | null;

  /** Last time operator panel had an active SSE connection. */
  @Column({ type: DataType.DATE, allowNull: true })
  declare panel_seen_at: Date | null;

  /** Why the session was closed (null while open). */
  @Column({ type: DataType.STRING(32), allowNull: true })
  declare close_reason: ShiftCloseReason | null;

  // Tenant isolation
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;
}
