import {
  Table, Column, Model, DataType,
  PrimaryKey, AutoIncrement, Default, AllowNull,
} from 'sequelize-typescript';

export type TenantModuleStatus = 'active' | 'inactive' | 'trial' | 'expired';
export type BillingCycle = 'monthly' | 'yearly' | 'lifetime';

@Table({
  tableName: 'tenant_modules',
  timestamps: false,
  indexes: [
    { unique: true, fields: ['tenant_id', 'module_code'], name: 'uq_tenant_module' },
    { fields: ['tenant_id'], name: 'idx_tm_tenant' },
  ],
})
export class TenantModule extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare tenant_id: number;

  @AllowNull(false)
  @Column(DataType.STRING(64))
  declare module_code: string;

  @Default('active')
  @Column(DataType.ENUM('active', 'inactive', 'trial', 'expired'))
  declare status: TenantModuleStatus;

  @Default(DataType.NOW)
  @Column(DataType.DATE)
  declare activated_at: Date;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare expires_at: Date | null;

  @Default('monthly')
  @Column(DataType.ENUM('monthly', 'yearly', 'lifetime'))
  declare billing_cycle: BillingCycle;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare last_billed_at: Date | null;

  /** Конфигурация специфичная для данного модуля у данного тенанта */
  @Default('{}')
  @Column(DataType.JSON)
  declare config: Record<string, unknown>;
}
