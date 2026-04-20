import { Column, DataType, Model, Table } from 'sequelize-typescript';

@Table({ tableName: 'queue_members_table', timestamps: false })
export class QueueMember extends Model {
  @Column({
    primaryKey: true,
    autoIncrement: true,
    type: DataType.INTEGER.UNSIGNED,
  })
  declare uniqueid: number;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare membername: string;

  @Column({ type: DataType.STRING(128), allowNull: false })
  declare queue_name: string;

  @Column({ type: DataType.STRING(128), allowNull: false })
  declare interface: string;

  @Column({ type: DataType.INTEGER, allowNull: true, defaultValue: 0 })
  declare penalty: number;

  @Column({ type: DataType.INTEGER, allowNull: true, defaultValue: 0 })
  declare paused: number;

  @Column({ type: DataType.STRING(128), allowNull: true })
  declare reason_paused: string;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare wrapuptime: number;

  @Column({ type: DataType.STRING(128), allowNull: true })
  declare state_interface: string;

  // Tenant isolation
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare vpbx_user_uid: number;
}
