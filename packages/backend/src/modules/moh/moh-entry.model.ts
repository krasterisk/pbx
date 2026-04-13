import { Table, Column, Model, DataType } from 'sequelize-typescript';

/**
 * Sequelize model for the Asterisk Realtime `musiconhold_entry` table.
 * Composite PK: (name, position) — standard Asterisk schema.
 * `entry` contains the absolute path to the audio file on the Asterisk server.
 */
@Table({ tableName: 'musiconhold_entry', timestamps: false, freezeTableName: true })
export class MohEntry extends Model {
  @Column({ type: DataType.STRING(80), primaryKey: true })
  declare name: string;

  @Column({ type: DataType.INTEGER, primaryKey: true })
  declare position: number;

  @Column({ type: DataType.STRING(256), allowNull: false })
  declare entry: string;
}
