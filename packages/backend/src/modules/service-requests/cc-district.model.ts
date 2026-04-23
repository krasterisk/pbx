import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, Default } from 'sequelize-typescript';

/**
 * CcDistrict — справочник территориальных зон и районов Call-центра.
 */
@Table({ tableName: 'cc_districts', timestamps: false, freezeTableName: true })
export class CcDistrict extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  declare uid: number;

  @Column({ type: DataType.STRING(128), allowNull: false })
  declare territorial_zone: string;

  @Column({ type: DataType.STRING(128), allowNull: false })
  declare district: string;

  @Default(0)
  @Column({ type: DataType.INTEGER })
  declare sort_order: number;

  @Default(true)
  @Column({ type: DataType.BOOLEAN })
  declare is_active: boolean;
}
