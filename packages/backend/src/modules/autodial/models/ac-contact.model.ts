import {
  Table, Column, Model, DataType, PrimaryKey, AutoIncrement,
  HasMany, CreatedAt, UpdatedAt, Default, ForeignKey, BelongsTo,
} from 'sequelize-typescript';
import { AcBase } from './ac-base.model';
import { AcContactPhone } from './ac-contact-phone.model';

@Table({
  tableName: 'ac_contacts',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  freezeTableName: true,
})
export class AcContact extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare uid: number;

  @ForeignKey(() => AcBase)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare base_uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false, field: 'vpbx_user_uid' })
  declare user_uid: number;

  @Column({ type: DataType.STRING(128), allowNull: true })
  declare external_id: string | null;

  @Column({ type: DataType.JSON, allowNull: false })
  declare values: Record<string, string | number | boolean>;

  @Default('')
  @Column({ type: DataType.STRING(512), allowNull: false })
  declare comment: string;

  @CreatedAt
  declare created_at: Date;

  @UpdatedAt
  declare updated_at: Date;

  @BelongsTo(() => AcBase, { foreignKey: 'base_uid' })
  declare base?: AcBase;

  @HasMany(() => AcContactPhone, { foreignKey: 'contact_uid', as: 'phones' })
  declare phones?: AcContactPhone[];
}
