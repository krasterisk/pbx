import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement } from 'sequelize-typescript';

@Table({ tableName: 'roles' })
export class Role extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  declare id: number;

  @Column({ type: DataType.STRING })
  declare name: string;

  // JSON field: stores permitted modules per category
  // Structure: { "table_module_pbx": [...], "table_module_inbound": [...], ... }
  @Column({ type: DataType.TEXT })
  declare role: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare comment: string;

  @Column({ type: DataType.INTEGER, defaultValue: 0, field: 'vpbx_user_uid' })
  declare vpbxUserUid: number;
}
