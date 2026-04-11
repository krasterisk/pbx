import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement } from 'sequelize-typescript';

@Table({ tableName: 'provision_templates', timestamps: false, freezeTableName: true })
export class ProvisionTemplate extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare uid: number;

  @Column({ type: DataType.STRING(128), allowNull: false })
  declare name: string;

  @Column({ type: DataType.STRING(64), allowNull: true, defaultValue: '' })
  declare vendor: string;

  @Column({ type: DataType.STRING(64), allowNull: true, defaultValue: '' })
  declare model: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare content: string;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare user_uid: number;
}
