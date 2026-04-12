import { Table, Column, Model, DataType } from 'sequelize-typescript';

/**
 * Sequelize model for Asterisk PJSIP endpoint identification by IP.
 * Maps to `ps_endpoint_id_ips` Realtime table used by res_pjsip_endpoint_identifier_ip.
 */
@Table({ tableName: 'ps_endpoint_id_ips', timestamps: false, freezeTableName: true })
export class PsEndpointIdIp extends Model {
  @Column({ type: DataType.STRING(40), primaryKey: true })
  declare id: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare endpoint: string;

  @Column({ type: DataType.STRING(80), allowNull: true })
  declare match: string;

  @Column({ type: DataType.ENUM('yes', 'no'), allowNull: true })
  declare srv_lookups: string;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare match_header: string;

  @Column({ type: DataType.STRING(40), allowNull: true, defaultValue: 'identify' })
  declare type: string;
}
