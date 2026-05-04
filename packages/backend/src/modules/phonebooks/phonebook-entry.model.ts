import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { RoutePhonebook } from './phonebook.model';

@Table({ tableName: 'route_phonebook_entries', timestamps: false, freezeTableName: true })
export class PhonebookEntry extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  declare uid: number;

  @ForeignKey(() => RoutePhonebook)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare phonebook_uid: number;

  @Column({ type: DataType.STRING(32), allowNull: false })
  declare number: string;

  @Column({ type: DataType.STRING(100), defaultValue: '' })
  declare label: string;

  @Column({ type: DataType.STRING(100), allowNull: true, defaultValue: null })
  declare dialto_context: string | null;

  @Column({ type: DataType.STRING(32), allowNull: true, defaultValue: null })
  declare dialto_exten: string | null;

  @Column({ type: DataType.DATE, field: 'created_at' })
  declare created_at: Date;

  @BelongsTo(() => RoutePhonebook, 'phonebook_uid')
  declare phonebook: RoutePhonebook;
}
