import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, Default } from 'sequelize-typescript';

/**
 * CcSubject — справочник тем обращений Call-центра.
 */
@Table({ tableName: 'cc_subjects', timestamps: false, freezeTableName: true })
export class CcSubject extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  declare uid: number;

  @Column({ type: DataType.STRING(255), allowNull: false })
  declare name: string;

  @Default(0)
  @Column({ type: DataType.INTEGER })
  declare sort_order: number;

  @Default(true)
  @Column({ type: DataType.BOOLEAN })
  declare is_active: boolean;
}
