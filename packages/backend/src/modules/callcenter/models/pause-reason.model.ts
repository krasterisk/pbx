import { Column, DataType, Model, Table } from 'sequelize-typescript';

@Table({ tableName: 'cc_pause_reasons', timestamps: false })
export class CcPauseReason extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
  declare uid: number;

  @Column({ type: DataType.STRING(128), allowNull: false })
  declare name: string;

  @Column({ type: DataType.STRING(7), allowNull: true, defaultValue: '#f59e0b' })
  declare color: string;

  /** Maximum pause duration in seconds (0 = unlimited) */
  @Column({ type: DataType.INTEGER, allowNull: true, defaultValue: 0 })
  declare max_duration: number;

  /** Whether this pause type counts as paid time */
  @Column({ type: DataType.BOOLEAN, allowNull: true, defaultValue: true })
  declare is_paid: boolean;

  @Column({ type: DataType.INTEGER, allowNull: true, defaultValue: 0 })
  declare sort_order: number;

  // Tenant isolation
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;
}
