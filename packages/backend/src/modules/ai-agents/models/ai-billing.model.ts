import { Column, DataType, Model, Table } from 'sequelize-typescript';

/**
 * Monthly billing snapshot per tenant — pre-aggregated for fast dashboards.
 * Source of truth remains `cc_ai_cdr`; this table is rebuilt by a nightly job.
 */
@Table({ tableName: 'cc_ai_billing', timestamps: false })
export class CcAiBilling extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.BIGINT })
  declare uid: number;

  /** YYYY-MM-01 (first day of month). */
  @Column({ type: DataType.DATEONLY, allowNull: false })
  declare period: string;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare total_calls: number;

  @Column({ type: DataType.BIGINT, allowNull: false, defaultValue: 0 })
  declare total_tokens_in: number;

  @Column({ type: DataType.BIGINT, allowNull: false, defaultValue: 0 })
  declare total_tokens_out: number;

  @Column({ type: DataType.BIGINT, allowNull: false, defaultValue: 0 })
  declare total_audio_seconds: number;

  @Column({ type: DataType.DECIMAL(14, 4), allowNull: false, defaultValue: 0 })
  declare total_cost: number;

  @Column({ type: DataType.STRING(8), allowNull: false, defaultValue: 'USD' })
  declare currency: string;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;
}
