import { Column, DataType, Model, Table } from 'sequelize-typescript';
import type { CallGroupMemberType } from '@krasterisk/shared';

@Table({ tableName: 'call_group_members', timestamps: false })
export class CallGroupMember extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
  declare uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare call_group_uid: number;

  @Column({
    type: DataType.ENUM('internal', 'external'),
    allowNull: false,
  })
  declare member_type: CallGroupMemberType;

  /** Extension number (internal) or external phone number */
  @Column({ type: DataType.STRING(128), allowNull: false })
  declare value: string;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare position: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 20 })
  declare ring_time: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;
}
