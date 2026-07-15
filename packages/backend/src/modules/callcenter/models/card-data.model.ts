import { Column, DataType, Model, Table } from 'sequelize-typescript';

/**
 * Saved call card instance — field values bound to a call (call_uniqueid).
 */
@Table({ tableName: 'cc_card_data', timestamps: false })
export class CcCardData extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.BIGINT })
  declare uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare template_id: number;

  @Column({ type: DataType.STRING(64), allowNull: true, defaultValue: '' })
  declare call_uniqueid: string;

  @Column({ type: DataType.STRING(32), allowNull: true, defaultValue: '' })
  declare caller_id: string;

  @Column({ type: DataType.STRING(64), allowNull: true, defaultValue: '' })
  declare queue_name: string;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare agent_user_uid: number | null;

  @Column({
    type: DataType.ENUM('draft', 'saved', 'missed', 'callback_done'),
    allowNull: false,
    defaultValue: 'saved',
  })
  declare status: 'draft' | 'saved' | 'missed' | 'callback_done';

  /** Filled values keyed by field_key. */
  @Column({ type: DataType.JSON, allowNull: false })
  declare field_values: Record<string, unknown>;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare created_at: Date;

  @Column({ type: DataType.DATE, allowNull: true })
  declare updated_at: Date | null;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;
}
