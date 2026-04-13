import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement } from 'sequelize-typescript';

@Table({ tableName: 'prompts', timestamps: false, freezeTableName: true })
export class Prompt extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  declare uid: number;

  @Column({ type: DataType.STRING(50), allowNull: false })
  declare filename: string;

  @Column({ type: DataType.STRING(128), allowNull: false, defaultValue: '' })
  declare moh: string;

  @Column({ type: DataType.STRING(128), allowNull: false, defaultValue: '' })
  declare comment: string;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare user_uid: number;
}
