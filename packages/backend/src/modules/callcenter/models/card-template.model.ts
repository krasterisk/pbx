import { Column, DataType, Model, Table } from 'sequelize-typescript';

/**
 * Call card template — supervisor-configured form schema (D-10/D-12/D-13).
 * CRM webhook uses notification_integration from Phase 6 (no separate credential store).
 */
@Table({ tableName: 'cc_card_templates', timestamps: false })
export class CcCardTemplate extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
  declare uid: number;

  @Column({ type: DataType.STRING(128), allowNull: false })
  declare name: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare description: string | null;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare is_active: boolean;

  /** D-12: per-template auto-open moment (manual replaces concept's 'never'). */
  @Column({
    type: DataType.ENUM('answer', 'ring', 'manual'),
    allowNull: false,
    defaultValue: 'answer',
  })
  declare auto_open_on: 'answer' | 'ring' | 'manual';

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare auto_save_on_timeout: boolean;

  /** FK to notification_integrations.uid — Phase 6 credential store (D-13). */
  @Column({ type: DataType.INTEGER, allowNull: true, defaultValue: null })
  declare webhook_integration_uid: number | null;

  /** Optional remap: field_key → payload_template variable name. */
  @Column({ type: DataType.JSON, allowNull: true, defaultValue: null })
  declare webhook_field_map: Record<string, string> | null;

  /** Queue names this template applies to (runtime resolves by call queue). */
  @Column({ type: DataType.JSON, allowNull: true, defaultValue: null })
  declare queue_names: string[] | null;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare created_at: Date;

  @Column({ type: DataType.DATE, allowNull: true })
  declare updated_at: Date | null;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;
}
