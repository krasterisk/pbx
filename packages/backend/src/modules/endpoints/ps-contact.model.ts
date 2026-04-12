import { Table, Column, Model, DataType } from 'sequelize-typescript';

@Table({ tableName: 'ps_contacts', timestamps: false, freezeTableName: true })
export class PsContact extends Model {
  @Column({ type: DataType.STRING(255), primaryKey: true })
  declare id: string;

  @Column({ type: DataType.STRING(511), allowNull: true })
  declare uri: string;

  @Column({ type: DataType.BIGINT, allowNull: true })
  declare expiration_time: number;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare qualify_frequency: number;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare outbound_proxy: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare path: string;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare user_agent: string;

  @Column({ type: DataType.FLOAT, allowNull: true })
  declare qualify_timeout: number;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare reg_server: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare authenticate_qualify: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare via_addr: string;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare via_port: number;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare call_id: string;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare endpoint: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare prune_on_boot: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare qualify_2xx_only: string;

  @Column({ type: DataType.DATE, allowNull: true })
  declare updatedAt: Date;
}
