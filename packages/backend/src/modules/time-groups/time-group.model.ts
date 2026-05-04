import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement } from 'sequelize-typescript';

@Table({ tableName: 'time_groups', timestamps: false, freezeTableName: true })
export class TimeGroup extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  declare uid: number;

  @Column({ type: DataType.STRING(100), allowNull: false })
  declare name: string;

  @Column({ type: DataType.STRING(255), defaultValue: '' })
  declare comment: string;

  @Column({ type: DataType.JSON, allowNull: false, defaultValue: [] })
  declare intervals: any[];

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare user_uid: number;

  @Column({ type: DataType.DATE, field: 'created_at' })
  declare created_at: Date;

  @Column({ type: DataType.DATE, field: 'updated_at' })
  declare updated_at: Date;
}
