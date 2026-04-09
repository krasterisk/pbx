import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement } from 'sequelize-typescript';

// "Numbers" (Списки доступа) — controls what each user/role can see:
// queues for joining, operator panels, supervisor stats, transfer panels,
// PBX settings visibility, CDR report scopes, etc.
@Table({ tableName: 'numbers' })
export class NumberList extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  declare id: number;

  @Column({ type: DataType.STRING })
  declare name: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare comment: string;

  // JSON: queues user can join
  @Column({ type: DataType.TEXT, allowNull: true })
  declare queues: string;

  // JSON: queues visible in operator panel
  @Column({ type: DataType.TEXT, allowNull: true })
  declare queues_ops: string;

  // JSON: operators visible in supervisor stats
  @Column({ type: DataType.TEXT, allowNull: true })
  declare ops_sv: string;

  // JSON: queues visible in supervisor stats
  @Column({ type: DataType.TEXT, allowNull: true })
  declare queues_sv: string;

  // JSON: queues visible in queue panel
  @Column({ type: DataType.TEXT, allowNull: true })
  declare queue_queues: string;

  // JSON: queues visible in transfer panel
  @Column({ type: DataType.TEXT, allowNull: true })
  declare trans_queues: string;

  // JSON: peers visible in transfer panel
  @Column({ type: DataType.TEXT, allowNull: true })
  declare trans_peers: string;

  // JSON: queues in PBX settings
  @Column({ type: DataType.TEXT, allowNull: true })
  declare queues_pbx: string;

  // JSON: inbound routes in PBX settings
  @Column({ type: DataType.TEXT, allowNull: true })
  declare inbound_pbx: string;

  // JSON: outbound routes in PBX settings
  @Column({ type: DataType.TEXT, allowNull: true })
  declare outbound_pbx: string;

  // JSON: IVR in PBX settings
  @Column({ type: DataType.TEXT, allowNull: true })
  declare ivr_pbx: string;

  // JSON: numbers lists in PBX settings
  @Column({ type: DataType.TEXT, allowNull: true })
  declare numbers_pbx: string;

  // JSON: operators in CDR report
  @Column({ type: DataType.TEXT, allowNull: true })
  declare ops_cdr: string;

  // JSON: peers in CDR report
  @Column({ type: DataType.TEXT, allowNull: true })
  declare peers_cdr: string;

  // JSON: inbound routes in CDR report
  @Column({ type: DataType.TEXT, allowNull: true })
  declare inbound_cdr: string;

  // JSON: outbound routes in CDR report
  @Column({ type: DataType.TEXT, allowNull: true })
  declare outbound_cdr: string;

  // JSON: queues in queue report
  @Column({ type: DataType.TEXT, allowNull: true })
  declare queues_cdr: string;

  @Column({ type: DataType.INTEGER, defaultValue: 0, field: 'vpbx_user_uid' })
  declare vpbxUserUid: number;
}
