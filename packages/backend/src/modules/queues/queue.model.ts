import { Column, DataType, Model, Table } from 'sequelize-typescript';

@Table({ tableName: 'queue_table', timestamps: false })
export class Queue extends Model {
  @Column({ primaryKey: true, type: DataType.STRING(128) })
  declare name: string;

  @Column({ type: DataType.STRING(128), allowNull: true })
  declare musiconhold: string;

  @Column({ type: DataType.STRING(128), allowNull: true })
  declare announce: string;

  @Column({ type: DataType.STRING(128), allowNull: true })
  declare context: string;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare timeout: number;

  @Column({ type: DataType.STRING(128), allowNull: true })
  declare strategy: string;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare retry: number;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare wrapuptime: number;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare maxlen: number;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare servicelevel: number;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare weight: number;

  @Column({ type: DataType.STRING(128), allowNull: true })
  declare joinempty: string;

  @Column({ type: DataType.STRING(128), allowNull: true })
  declare leavewhenempty: string;

  @Column({ type: DataType.BOOLEAN, allowNull: true })
  declare ringinuse: boolean;

  // Announcement fields
  @Column({ type: DataType.INTEGER, allowNull: true })
  declare announce_frequency: number;

  @Column({ type: DataType.STRING(128), allowNull: true })
  declare announce_holdtime: string;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare announce_round_seconds: number;

  @Column({ type: DataType.STRING(50), allowNull: true })
  declare periodic_announce: string;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare periodic_announce_frequency: number;

  @Column({ type: DataType.STRING(128), allowNull: true })
  declare queue_youarenext: string;

  @Column({ type: DataType.STRING(128), allowNull: true })
  declare queue_thereare: string;

  @Column({ type: DataType.STRING(128), allowNull: true })
  declare queue_callswaiting: string;

  @Column({ type: DataType.STRING(128), allowNull: true })
  declare queue_holdtime: string;

  @Column({ type: DataType.STRING(128), allowNull: true })
  declare queue_minutes: string;

  @Column({ type: DataType.STRING(128), allowNull: true })
  declare queue_seconds: string;

  @Column({ type: DataType.STRING(128), allowNull: true })
  declare queue_lessthan: string;

  @Column({ type: DataType.STRING(128), allowNull: true })
  declare queue_thankyou: string;

  @Column({ type: DataType.STRING(128), allowNull: true })
  declare queue_reporthold: string;

  // Advanced fields
  @Column({ type: DataType.STRING(128), allowNull: true })
  declare monitor_format: string;

  @Column({ type: DataType.BOOLEAN, allowNull: true })
  declare monitor_join: boolean;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare memberdelay: number;

  @Column({ type: DataType.BOOLEAN, allowNull: true })
  declare timeoutrestart: boolean;

  @Column({ type: DataType.BOOLEAN, allowNull: true })
  declare reportholdtime: boolean;

  @Column({ type: DataType.BOOLEAN, allowNull: true })
  declare eventmemberstatus: boolean;

  @Column({ type: DataType.BOOLEAN, allowNull: true })
  declare eventwhencalled: boolean;

  @Column({ type: DataType.BOOLEAN, allowNull: true })
  declare setinterfacevar: boolean;

  // Display name (ignored by Asterisk, used by our UI)
  @Column({ type: DataType.STRING(255), allowNull: true })
  declare display_name: string;

  // Tenant isolation (DB column: vpbx_user_uid — Asterisk Realtime table)
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;
}
