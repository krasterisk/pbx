import { Table, Column, Model, DataType, PrimaryKey } from 'sequelize-typescript';

/**
 * Asterisk CDR table (extended via cdr_adaptive_odbc.conf).
 * One row = one call leg; use GROUP BY linkedid in service for call summaries.
 */
@Table({ tableName: 'cdr', timestamps: false, freezeTableName: true })
export class Cdr extends Model {
  @Column({ type: DataType.STRING(80), allowNull: true })
  declare calldate: string;

  @Column({ type: DataType.STRING(80), allowNull: false, defaultValue: '' })
  declare clid: string;

  @Column({ type: DataType.STRING(80), allowNull: false, defaultValue: '' })
  declare src: string;

  @Column({ type: DataType.STRING(80), allowNull: false, defaultValue: '' })
  declare usrc: string;

  @Column({ type: DataType.STRING(80), allowNull: false, defaultValue: '' })
  declare dst: string;

  @Column({ type: DataType.STRING(80), allowNull: false, defaultValue: '' })
  declare dcontext: string;

  @Column({ type: DataType.STRING(80), allowNull: false, defaultValue: '' })
  declare channel: string;

  @Column({ type: DataType.STRING(80), allowNull: false, defaultValue: '' })
  declare dstchannel: string;

  @Column({ type: DataType.STRING(80), allowNull: false, defaultValue: '' })
  declare lastapp: string;

  @Column({ type: DataType.STRING(80), allowNull: false, defaultValue: '' })
  declare lastdata: string;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare duration: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare billsec: number;

  @Column({ type: DataType.STRING(45), allowNull: false, defaultValue: '' })
  declare disposition: string;

  @PrimaryKey
  @Column({ type: DataType.STRING(80), allowNull: false })
  declare uniqueid: string;

  @Column({ type: DataType.STRING(80), allowNull: false, defaultValue: '' })
  declare linkedid: string;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare userfield: string;

  @Column({ type: DataType.STRING(20), allowNull: true })
  declare dialednum: string | null;

  @Column({ type: DataType.STRING(80), allowNull: true })
  declare transid: string | null;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare record: string | null;

  @Column({ type: DataType.INTEGER, allowNull: true, defaultValue: 0 })
  declare vpbx_user_uid: number;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare useruid: number | null;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare dstuseruid: number | null;
}
