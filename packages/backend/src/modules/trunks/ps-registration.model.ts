import { Table, Column, Model, DataType } from 'sequelize-typescript';

/**
 * Sequelize model for Asterisk PJSIP outbound registrations.
 * Maps to the `ps_registrations` Realtime table used by res_pjsip_outbound_registration.
 */
@Table({ tableName: 'ps_registrations', timestamps: false, freezeTableName: true })
export class PsRegistration extends Model {
  @Column({ type: DataType.STRING(40), primaryKey: true })
  declare id: string;

  @Column({ type: DataType.ENUM('yes', 'no'), allowNull: true })
  declare auth_rejection_permanent: string;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare client_uri: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare contact_user: string;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare expiration: number;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare max_retries: number;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare outbound_auth: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare outbound_proxy: string;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare retry_interval: number;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare forbidden_retry_interval: number;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare server_uri: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare transport: string;

  @Column({ type: DataType.ENUM('yes', 'no'), allowNull: true })
  declare support_path: string;

  @Column({ type: DataType.ENUM('yes', 'no'), allowNull: true })
  declare line: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare endpoint: string;

  @Column({ type: DataType.STRING(40), allowNull: true, defaultValue: 'registration' })
  declare type: string;
}
