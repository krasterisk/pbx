import { Table, Column, Model, DataType } from 'sequelize-typescript';

@Table({ tableName: 'ps_auths', timestamps: false, freezeTableName: true })
export class PsAuth extends Model {
  @Column({ type: DataType.STRING(255), primaryKey: true })
  declare id: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare auth_type: string;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare nonce_lifetime: number;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare md5_cred: string;

  @Column({ type: DataType.STRING(80), allowNull: true })
  declare password: string;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare realm: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare username: string;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare refresh_token: string;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare oauth_clientid: string;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare oauth_secret: string;

  @Column({ type: DataType.STRING(1024), allowNull: true })
  declare password_digest: string;

  @Column({ type: DataType.STRING(1024), allowNull: true })
  declare supported_algorithms_uas: string;

  @Column({ type: DataType.STRING(1024), allowNull: true })
  declare supported_algorithms_uac: string;
}
