import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, Default } from 'sequelize-typescript';

@Table({ tableName: 'action_logs', timestamps: false, freezeTableName: true })
export class ActionLog extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  declare id: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare user_id: number;

  @Column({ type: DataType.STRING(64), allowNull: false })
  declare action: string;

  @Column({ type: DataType.STRING(64), allowNull: false })
  declare entity_type: string;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare entity_id: number | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare details: string | null;

  @Column({ type: DataType.INTEGER, allowNull: false, field: 'vpbx_user_uid' })
  declare user_uid: number;

  /**
   * Added: 'success' | 'error'
   * ALTER TABLE action_logs ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'success' AFTER details;
   */
  @Default('success')
  @Column({ type: DataType.STRING(16), allowNull: false })
  declare status: 'success' | 'error';

  @Column({ type: DataType.DATE, defaultValue: DataType.NOW })
  declare created_at: Date;
}
