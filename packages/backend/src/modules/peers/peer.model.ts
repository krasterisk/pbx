import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement } from 'sequelize-typescript';

@Table({ tableName: 'sippeers' })
export class Peer extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  declare uid: number;

  @Column({ type: DataType.STRING })
  declare name: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare fullname: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare exten: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare secret: string;

  @Column({ type: DataType.STRING, allowNull: true, field: 'peer_type' })
  declare peer_type: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare context: string;

  @Column({ type: DataType.INTEGER, defaultValue: 1 })
  declare active: number;

  @Column({ type: DataType.STRING, allowNull: true })
  declare callerid: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare transport: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare email: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare mobile: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare dtmfmode: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare nat: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare callgroup: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare pickupgroup: string;

  @Column({ type: DataType.STRING, allowNull: true, field: 'call-limit' })
  declare callLimit: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare qualify: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare department: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare comment: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare pv_vars: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare mac: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare ipei: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare mac_prefix: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare ap_template: string;

  @Column({ type: DataType.INTEGER, defaultValue: 0 })
  declare ap_enable: number;

  @Column({ type: DataType.INTEGER, defaultValue: 0 })
  declare allow_redirect: number;

  @Column({ type: DataType.INTEGER, defaultValue: 0 })
  declare lb_noshow: number;

  @Column({ type: DataType.STRING, allowNull: true })
  declare useragent: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare ipaddr: string;

  @Column({ type: DataType.INTEGER, defaultValue: 0 })
  declare vpbx_user_uid: number;
}
