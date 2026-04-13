import { Table, Column, Model, DataType, PrimaryKey } from 'sequelize-typescript';

/**
 * Sequelize model for the Asterisk Realtime `musiconhold` table.
 * Uses mode=files with entries read from `musiconhold_entry`.
 * Column `user_uid` is custom (Asterisk ignores unknown columns).
 */
@Table({ tableName: 'musiconhold', timestamps: false, freezeTableName: true })
export class MohClass extends Model {
  @PrimaryKey
  @Column({ type: DataType.STRING(80), field: 'name' })
  declare name: string;

  @Column({
    type: DataType.ENUM('custom', 'files', 'mp3nb', 'quietmp3nb', 'quietmp3', 'playlist'),
    allowNull: true,
    defaultValue: 'files',
  })
  declare mode: string;

  @Column({ type: DataType.STRING(256), allowNull: true })
  declare directory: string;

  @Column({ type: DataType.STRING(10), allowNull: true, defaultValue: 'random' })
  declare sort: string;

  @Column({ type: DataType.INTEGER, allowNull: true, defaultValue: 0 })
  declare user_uid: number;
}
