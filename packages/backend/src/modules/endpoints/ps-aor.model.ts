import { Table, Column, Model, DataType } from 'sequelize-typescript';

@Table({ tableName: 'ps_aors', timestamps: false, freezeTableName: true })
export class PsAor extends Model {
  @Column({ type: DataType.STRING(255), primaryKey: true })
  declare id: string;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare contact: string;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare default_expiration: number;

  @Column({ type: DataType.STRING(80), allowNull: true })
  declare mailboxes: string;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare max_contacts: number;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare minimum_expiration: number;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare maximum_expiration: number;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare remove_existing: string;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare qualify_frequency: number;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare authenticate_qualify: string;

  @Column({ type: DataType.FLOAT, allowNull: true })
  declare qualify_timeout: number;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare outbound_proxy: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare support_path: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare voicemail_extension: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare remove_unavailable: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare qualify_2xx_only: string;
}
