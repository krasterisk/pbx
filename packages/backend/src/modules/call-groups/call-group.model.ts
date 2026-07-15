import { Column, DataType, Model, Table } from 'sequelize-typescript';
import type { RingStrategy } from '@krasterisk/shared';

@Table({ tableName: 'call_groups', timestamps: false })
export class CallGroup extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
  declare uid: number;

  @Column({ type: DataType.STRING(128), allowNull: false })
  declare name: string;

  @Column({
    type: DataType.ENUM('ringall', 'hunt', 'memoryhunt', 'random'),
    allowNull: false,
  })
  declare strategy: RingStrategy;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 25 })
  declare ring_time: number;

  @Column({ type: DataType.STRING(128), allowNull: true })
  declare external_context: string | null;

  @Column({ type: DataType.STRING(64), allowNull: true })
  declare cid_prefix: string | null;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;
}
