import { Column, DataType, Model, Table } from 'sequelize-typescript';

@Table({ tableName: 'queue_member_table', timestamps: false })
export class QueueMember extends Model {
  @Column({
    primaryKey: true,
    autoIncrement: true,
    type: DataType.INTEGER.UNSIGNED,
  })
  uniqueid: number;

  @Column({ type: DataType.STRING(40), allowNull: true })
  membername: string;

  @Column({ type: DataType.STRING(128), allowNull: false })
  queue_name: string;

  @Column({ type: DataType.STRING(128), allowNull: false })
  interface: string;

  @Column({ type: DataType.INTEGER, allowNull: true, defaultValue: 0 })
  penalty: number;

  @Column({ type: DataType.INTEGER, allowNull: true, defaultValue: 0 })
  paused: number;

  @Column({ type: DataType.INTEGER, allowNull: true })
  wrapuptime: number;

  @Column({ type: DataType.STRING(128), allowNull: true })
  state_interface: string;

  // Tenant isolation
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  vpbx_user_uid: number;
}
