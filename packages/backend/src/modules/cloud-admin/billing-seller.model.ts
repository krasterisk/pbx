import {
  Table, Column, Model, DataType,
  PrimaryKey, AutoIncrement, Default, AllowNull, HasMany,
} from 'sequelize-typescript';
import { Tenant } from './tenant.model';

@Table({
  tableName: 'billing_sellers',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
})
export class BillingSeller extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  declare id: number;

  @AllowNull(false)
  @Column({ type: DataType.STRING(255) })
  declare name: string;

  @Column({ type: DataType.STRING(32), allowNull: true })
  declare inn: string | null;

  @Column({ type: DataType.STRING(32), allowNull: true })
  declare kpp: string | null;

  @Column({ type: DataType.STRING(32), allowNull: true })
  declare ogrn: string | null;

  @Column({ type: DataType.STRING(512), allowNull: true })
  declare address: string | null;

  @Column({ type: DataType.STRING(255), allowNull: true, field: 'bank_name' })
  declare bankName: string | null;

  @Column({ type: DataType.STRING(32), allowNull: true, field: 'bank_bik' })
  declare bankBik: string | null;

  @Column({ type: DataType.STRING(64), allowNull: true, field: 'bank_account' })
  declare bankAccount: string | null;

  @Column({ type: DataType.STRING(64), allowNull: true, field: 'corr_account' })
  declare corrAccount: string | null;

  @Column({ type: DataType.STRING(512), allowNull: true, field: 'service_description' })
  declare serviceDescription: string | null;

  @Column({ type: DataType.STRING(32), allowNull: true, field: 'service_code' })
  declare serviceCode: string | null;

  @Default(false)
  @AllowNull(false)
  @Column({ type: DataType.BOOLEAN, field: 'is_default' })
  declare isDefault: boolean;

  @HasMany(() => Tenant, { foreignKey: 'seller_id', as: 'tenants' })
  declare tenants?: Tenant[];

  declare created_at: Date;
  declare updated_at: Date;
}
