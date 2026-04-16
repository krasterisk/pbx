import { Column, DataType, Model, Table } from 'sequelize-typescript';

@Table({ tableName: 'queue_table', timestamps: false })
export class Queue extends Model {
  @Column({ primaryKey: true, type: DataType.STRING(128) })
  name: string;

  @Column({ type: DataType.STRING(128), allowNull: true })
  musiconhold: string;

  @Column({ type: DataType.STRING(128), allowNull: true })
  announce: string;

  @Column({ type: DataType.STRING(128), allowNull: true })
  context: string;

  @Column({ type: DataType.INTEGER, allowNull: true })
  timeout: number;

  @Column({ type: DataType.STRING(128), allowNull: true })
  strategy: string;

  @Column({ type: DataType.INTEGER, allowNull: true })
  retry: number;

  @Column({ type: DataType.INTEGER, allowNull: true })
  wrapuptime: number;

  @Column({ type: DataType.INTEGER, allowNull: true })
  maxlen: number;

  @Column({ type: DataType.INTEGER, allowNull: true })
  servicelevel: number;

  @Column({ type: DataType.INTEGER, allowNull: true })
  weight: number;

  @Column({ type: DataType.STRING(128), allowNull: true })
  joinempty: string;

  @Column({ type: DataType.STRING(128), allowNull: true })
  leavewhenempty: string;

  @Column({ type: DataType.BOOLEAN, allowNull: true })
  ringinuse: boolean;

  // Announcement fields
  @Column({ type: DataType.INTEGER, allowNull: true })
  announce_frequency: number;

  @Column({ type: DataType.STRING(128), allowNull: true })
  announce_holdtime: string;

  @Column({ type: DataType.INTEGER, allowNull: true })
  announce_round_seconds: number;

  @Column({ type: DataType.STRING(50), allowNull: true })
  periodic_announce: string;

  @Column({ type: DataType.INTEGER, allowNull: true })
  periodic_announce_frequency: number;

  @Column({ type: DataType.STRING(128), allowNull: true })
  queue_youarenext: string;

  @Column({ type: DataType.STRING(128), allowNull: true })
  queue_thereare: string;

  @Column({ type: DataType.STRING(128), allowNull: true })
  queue_callswaiting: string;

  @Column({ type: DataType.STRING(128), allowNull: true })
  queue_holdtime: string;

  @Column({ type: DataType.STRING(128), allowNull: true })
  queue_minutes: string;

  @Column({ type: DataType.STRING(128), allowNull: true })
  queue_seconds: string;

  @Column({ type: DataType.STRING(128), allowNull: true })
  queue_lessthan: string;

  @Column({ type: DataType.STRING(128), allowNull: true })
  queue_thankyou: string;

  @Column({ type: DataType.STRING(128), allowNull: true })
  queue_reporthold: string;

  // Advanced fields
  @Column({ type: DataType.STRING(128), allowNull: true })
  monitor_format: string;

  @Column({ type: DataType.BOOLEAN, allowNull: true })
  monitor_join: boolean;

  @Column({ type: DataType.INTEGER, allowNull: true })
  memberdelay: number;

  @Column({ type: DataType.BOOLEAN, allowNull: true })
  timeoutrestart: boolean;

  @Column({ type: DataType.BOOLEAN, allowNull: true })
  reportholdtime: boolean;

  @Column({ type: DataType.BOOLEAN, allowNull: true })
  eventmemberstatus: boolean;

  @Column({ type: DataType.BOOLEAN, allowNull: true })
  eventwhencalled: boolean;

  @Column({ type: DataType.BOOLEAN, allowNull: true })
  setinterfacevar: boolean;

  // Display name (ignored by Asterisk, used by our UI)
  @Column({ type: DataType.STRING(255), allowNull: true })
  display_name: string;

  // Tenant isolation
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  vpbx_user_uid: number;
}
