import { Column, DataType, Model, Table } from 'sequelize-typescript';

@Table({ tableName: 'conference_room_moderators', timestamps: false, freezeTableName: true })
export class ConferenceRoomModerator extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
  declare uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare room_uid: number;

  @Column({ type: DataType.STRING(64), allowNull: false })
  declare endpoint_ref: string;

  @Column({
    type: DataType.ENUM('owner', 'moderator'),
    allowNull: false,
    defaultValue: 'moderator',
  })
  declare role: 'owner' | 'moderator';
}
