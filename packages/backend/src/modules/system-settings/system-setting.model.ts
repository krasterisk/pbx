import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement } from 'sequelize-typescript';

@Table({ tableName: 'system_settings', timestamps: false, freezeTableName: true })
export class SystemSetting extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  declare uid: number;

  @Column({ type: DataType.STRING(128), allowNull: false, unique: true })
  declare key: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare value: string | null;

  @Column({ type: DataType.STRING(64), allowNull: false, defaultValue: 'general' })
  declare category: string;

  @Column({ type: DataType.DATE, field: 'updated_at', defaultValue: DataType.NOW })
  declare updated_at: Date;
}
