import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement } from 'sequelize-typescript';

@Table({ tableName: 'action_logs', timestamps: false })
export class ActionLog extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  declare id: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare user_id: number;

  @Column({ type: DataType.STRING, allowNull: false })
  declare action: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare entity_type: string;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare entity_id: number;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare details: string;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare vpbx_user_uid: number;

  @Column({ type: DataType.DATE, defaultValue: DataType.NOW })
  declare created_at: Date;
}
