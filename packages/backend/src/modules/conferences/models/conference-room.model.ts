import { Column, DataType, Model, Table } from 'sequelize-typescript';

export type ConferenceRoomKind = 'permanent' | 'ephemeral';
export type ConferenceEntryStrictness =
  | 'token_name'
  | 'token_name_pin'
  | 'token_name_pin_moderator';
export type ConferenceRecordMode = 'off' | 'auto' | 'button' | 'both';
export type ConferenceInviteScope = 'owner' | 'moderator' | 'anyone';

@Table({ tableName: 'conference_rooms', timestamps: false, freezeTableName: true })
export class ConferenceRoom extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
  declare uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false, field: 'vpbx_user_uid' })
  declare user_uid: number;

  @Column({ type: DataType.STRING(32), allowNull: false })
  declare number: string;

  @Column({ type: DataType.STRING(255), allowNull: false })
  declare name: string;

  @Column({
    type: DataType.ENUM('permanent', 'ephemeral'),
    allowNull: false,
    defaultValue: 'permanent',
  })
  declare kind: ConferenceRoomKind;

  @Column({
    type: DataType.ENUM('token_name', 'token_name_pin', 'token_name_pin_moderator'),
    allowNull: false,
    defaultValue: 'token_name',
  })
  declare entry_strictness: ConferenceEntryStrictness;

  @Column({ type: DataType.STRING(32), allowNull: true })
  declare pin: string | null;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  declare wait_marked: boolean;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  declare end_marked: boolean;

  @Column({
    type: DataType.ENUM('off', 'auto', 'button', 'both'),
    allowNull: false,
    defaultValue: 'off',
  })
  declare record_mode: ConferenceRecordMode;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare notify_recording: boolean;

  @Column({
    type: DataType.ENUM('owner', 'moderator', 'anyone'),
    allowNull: false,
    defaultValue: 'owner',
  })
  declare invite_external_scope: ConferenceInviteScope;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare tariff_max_participants: number | null;

  @Column({ type: DataType.STRING(128), allowNull: true })
  declare musiconhold: string | null;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  declare announce_join_leave: boolean;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare created_by: number | null;

  @Column({ type: DataType.DATE, allowNull: true })
  declare created_at: Date | null;

  @Column({ type: DataType.DATE, allowNull: true })
  declare updated_at: Date | null;
}
