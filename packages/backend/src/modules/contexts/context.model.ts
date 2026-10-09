import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement } from 'sequelize-typescript';

@Table({ tableName: 'contexts', timestamps: false, freezeTableName: true })
export class Context extends Model {
  @Column({ type: DataType.VIRTUAL })
  declare include_uids: number[];
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  declare uid: number;

  @Column({ type: DataType.STRING(128), allowNull: false })
  declare name: string;

  @Column({ type: DataType.STRING(128), allowNull: false, defaultValue: '' })
  declare comment: string;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare user_uid: number;

  @Column({ type: DataType.VIRTUAL })
  declare is_default_for_endpoints: boolean;

  @Column({ type: DataType.VIRTUAL })
  declare is_default_for_trunks: boolean;
}
