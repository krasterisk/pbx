import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, HasMany } from 'sequelize-typescript';
import { PhonebookEntry } from './phonebook-entry.model';

@Table({ tableName: 'route_phonebooks', timestamps: false, freezeTableName: true })
export class RoutePhonebook extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  declare uid: number;

  @Column({ type: DataType.STRING(100), allowNull: false })
  declare name: string;

  @Column({ type: DataType.STRING(255), defaultValue: '' })
  declare description: string;

  @Column({ type: DataType.TINYINT, defaultValue: 0 })
  declare invert: number;

  @Column({ type: DataType.JSON, allowNull: true, defaultValue: null })
  declare actions: any[];

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare user_uid: number;

  @Column({ type: DataType.DATE, field: 'created_at' })
  declare created_at: Date;

  @Column({ type: DataType.DATE, field: 'updated_at' })
  declare updated_at: Date;

  @HasMany(() => PhonebookEntry, 'phonebook_uid')
  declare entries: PhonebookEntry[];
}
