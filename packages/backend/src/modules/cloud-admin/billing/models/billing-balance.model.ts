import {
  Table, Column, Model, DataType,
  PrimaryKey, AutoIncrement, Default, AllowNull, Unique,
} from 'sequelize-typescript';

/**
 * Баланс тенанта.
 * Все суммы хранятся в КОПЕЙКАХ (integer) — исключает float-ошибки.
 * Для отображения: kopecks / 100.
 */
@Table({ tableName: 'billing_balances', timestamps: false, updatedAt: 'updated_at' })
export class BillingBalance extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @Unique
  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare tenant_id: number;

  /** Текущий баланс в копейках */
  @Default(0)
  @Column(DataType.BIGINT)
  declare balance_kopecks: number;

  /** Кредитный лимит (для постоплаты) */
  @Default(0)
  @Column(DataType.BIGINT)
  declare credit_limit_kopecks: number;

  @Default('RUB')
  @Column(DataType.STRING(3))
  declare currency: string;

  /** Блокировка при нулевом балансе */
  @Default(false)
  @Column(DataType.BOOLEAN)
  declare is_blocked: boolean;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare blocked_at: Date | null;

  @Default(DataType.NOW)
  @Column(DataType.DATE)
  declare updated_at: Date;
}
