import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, ForeignKey } from 'sequelize-typescript';
import { Context } from '../contexts/context.model';

@Table({ tableName: 'context_includes', timestamps: false, freezeTableName: true })
export class ContextInclude extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  declare uid: number;

  @ForeignKey(() => Context)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare context_uid: number;

  @ForeignKey(() => Context)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare include_uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare priority: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare user_uid: number;
}
