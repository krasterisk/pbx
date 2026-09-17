import {
  Table, Column, Model, DataType, PrimaryKey, AutoIncrement, Default, ForeignKey, BelongsTo,
} from 'sequelize-typescript';
import { AcContact } from './ac-contact.model';

@Table({
  tableName: 'ac_contact_phones',
  timestamps: false,
  freezeTableName: true,
})
export class AcContactPhone extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare uid: number;

  @ForeignKey(() => AcContact)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare contact_uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare base_uid: number;

  @Column({ type: DataType.STRING(64), allowNull: false })
  declare raw: string;

  @Column({ type: DataType.STRING(64), allowNull: false })
  declare normalized: string;

  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare position: number;

  @Default(false)
  @Column({ type: DataType.BOOLEAN, allowNull: false })
  declare is_primary: boolean;

  /** Minutes east of UTC; default Europe/Moscow = +180 */
  @Default(180)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare tz_offset_min: number;

  @BelongsTo(() => AcContact, { foreignKey: 'contact_uid' })
  declare contact?: AcContact;
}
