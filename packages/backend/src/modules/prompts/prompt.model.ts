import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement } from 'sequelize-typescript';

@Table({ tableName: 'prompts', timestamps: false, freezeTableName: true })
export class Prompt extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  declare uid: number;

  @Column({ type: DataType.STRING(50), allowNull: false })
  declare filename: string;

  /** Название записи (отображаемое имя) */
  @Column({ type: DataType.STRING(128), allowNull: false, defaultValue: '' })
  declare comment: string;

  /** Произвольный комментарий (колонка `moh` в legacy-схеме БД) */
  @Column({ type: DataType.STRING(128), field: 'moh', allowNull: false, defaultValue: '' })
  declare description: string;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare user_uid: number;
}
