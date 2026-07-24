import { Column, DataType, Model, Table } from 'sequelize-typescript';
import type {
  AutoPauseRule,
  NotificationMatrix,
  PermissionLocks,
  PermissionSet,
  UiVisibility,
} from './cc-permissions.types';
import type { UserLevel } from '../../users/user.model';

/**
 * Per-tenant call-center settings singleton (D-07 default SLA + D-27 alert thresholds).
 * Unique on vpbx_user_uid.
 */
@Table({ tableName: 'cc_settings', timestamps: false })
export class CcSettings extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
  declare uid: number;

  /** D-07: tenant default SLA threshold (sec) when queue has no servicelevel. */
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 20 })
  declare default_sla_threshold: number;

  /** D-04: softphone Journal tab depth (last N rows); admin-configurable, default 50. */
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 50 })
  declare journal_depth: number;

  /**
   * D-27: flexible alert thresholds JSON.
   * Known keys: max_wait_sec, abandon_rate_pct, sla_critical_pct, agents_available_min.
   */
  @Column({ type: DataType.JSON, allowNull: true })
  declare alert_thresholds: Record<string, number> | null;

  /** D-27: play alert sound on wallboard. */
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare alert_sound_enabled: boolean;

  /**
   * D-38/D-39: role = set of rights (default), keyed by UserLevel. Per-operator overrides
   * live as columns on CcOperatorSettings; merge precedence is resolved by the
   * permissions service (09-05), not here.
   */
  @Column({ type: DataType.JSON, allowNull: true, defaultValue: null })
  declare role_permission_defaults: Partial<Record<UserLevel, Partial<PermissionSet>>> | null;

  /**
   * D-06/D-39: per-right lock flags keyed by UserLevel — a locked right cannot be
   * self-overridden by the operator; `CallCenterPermissionsService.getEffective` always
   * returns the role default for a locked right regardless of the operator's own column value.
   */
  @Column({ type: DataType.JSON, allowNull: true, defaultValue: null })
  declare permission_locks: Partial<Record<UserLevel, PermissionLocks>> | null;

  /** D-05/D-06: role-default tab/panel visibility (per-operator override on CcOperatorSettings). */
  @Column({ type: DataType.JSON, allowNull: true, defaultValue: null })
  declare ui_visibility_defaults: UiVisibility | null;

  /** D-06: keys locked by admin/supervisor — operator cannot override these ui_visibility keys. */
  @Column({ type: DataType.JSON, allowNull: true, defaultValue: null })
  declare ui_visibility_locks: UiVisibility | null;

  /** D-41/D-43: role-default notification matrix (per-operator override on CcOperatorSettings). */
  @Column({ type: DataType.JSON, allowNull: true, defaultValue: null })
  declare notification_defaults: NotificationMatrix | null;

  /** D-43: notification matrix entries locked by admin/supervisor. */
  @Column({ type: DataType.JSON, allowNull: true, defaultValue: null })
  declare notification_locks: NotificationMatrix | null;

  /** D-15: tenant-wide flexible auto-pause rules (missed-count / idle-time / status-duration). */
  @Column({ type: DataType.JSON, allowNull: true, defaultValue: null })
  declare autopause_rules: AutoPauseRule[] | null;

  /**
   * Master switch for the auto-pause engine (RONA + autopause_rules).
   * When false, CallCenterAutoPauseService does not pause anyone.
   */
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare autopause_enabled: boolean;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare updated_at: Date;

  // Tenant isolation — singleton per tenant
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;
}
