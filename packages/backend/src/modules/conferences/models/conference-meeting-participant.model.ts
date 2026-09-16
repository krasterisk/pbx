import { Column, DataType, Model, Table } from 'sequelize-typescript';

export type ConferenceMeetingParticipantRole = 'owner' | 'moderator' | 'participant';

@Table({
  tableName: 'conference_meeting_participants',
  timestamps: false,
  freezeTableName: true,
})
export class ConferenceMeetingParticipant extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
  declare uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare meeting_uid: number;

  @Column({ type: DataType.STRING(255), allowNull: false })
  declare display_name: string;

  @Column({
    type: DataType.ENUM('owner', 'moderator', 'participant'),
    allowNull: false,
    defaultValue: 'participant',
  })
  declare role: ConferenceMeetingParticipantRole;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  declare is_guest: boolean;

  @Column({ type: DataType.DATE, allowNull: false })
  declare joined_at: Date;

  @Column({ type: DataType.DATE, allowNull: true })
  declare left_at: Date | null;

  @Column({ type: DataType.STRING(64), allowNull: true })
  declare caller_id_num: string | null;

  @Column({ type: DataType.STRING(64), allowNull: true })
  declare uniqueid: string | null;
}
