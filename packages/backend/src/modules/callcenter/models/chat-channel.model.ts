import { Column, DataType, Model, Table } from 'sequelize-typescript';
import type { CcChatChannelType } from './chat-message.model';

@Table({ tableName: 'cc_chat_channels', timestamps: false })
export class CcChatChannel extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.BIGINT })
  declare uid: number;

  @Column({ type: DataType.STRING(128), allowNull: false })
  declare channel_key: string;

  @Column({
    type: DataType.ENUM('direct', 'group', 'broadcast_all', 'broadcast_queue'),
    allowNull: false,
  })
  declare type: CcChatChannelType;

  @Column({ type: DataType.STRING(128), allowNull: true })
  declare name: string;

  @Column({ type: DataType.JSON, allowNull: true })
  declare member_user_ids: number[];

  @Column({ type: DataType.STRING(64), allowNull: true })
  declare queue_name: string;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare created_by: number;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare created_at: Date;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;
}
