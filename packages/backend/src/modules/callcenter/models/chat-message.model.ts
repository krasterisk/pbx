import { Column, DataType, Model, Table } from 'sequelize-typescript';

export type CcChatChannelType = 'direct' | 'group' | 'broadcast_all' | 'broadcast_queue';

@Table({ tableName: 'cc_chat_messages', timestamps: false })
export class CcChatMessage extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.BIGINT })
  declare uid: number;

  @Column({ type: DataType.STRING(128), allowNull: false })
  declare channel_key: string;

  @Column({
    type: DataType.ENUM('direct', 'group', 'broadcast_all', 'broadcast_queue'),
    allowNull: false,
  })
  declare channel_type: CcChatChannelType;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare sender_user_id: number;

  @Column({ type: DataType.STRING(128), allowNull: true })
  declare sender_name: string;

  @Column({ type: DataType.TEXT, allowNull: false })
  declare body: string;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare created_at: Date;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;
}
