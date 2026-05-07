import {
  Table, Column, Model, DataType,
  PrimaryKey, AutoIncrement, Default, AllowNull, Unique,
} from 'sequelize-typescript';

export type TransactionType = 'deposit' | 'charge' | 'refund' | 'correction';
export type SbisStatus = 'pending' | 'done' | 'failed';

@Table({
  tableName: 'billing_transactions',
  timestamps: false,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [{ fields: ['tenant_id', 'created_at'], name: 'idx_bt_tenant_date' }],
})
export class BillingTransaction extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare id: number;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare tenant_id: number;

  @AllowNull(false)
  @Column(DataType.ENUM('deposit', 'charge', 'refund', 'correction'))
  declare type: TransactionType;

  /** Сумма операции в копейках (всегда положительная) */
  @AllowNull(false)
  @Column(DataType.BIGINT)
  declare amount_kopecks: number;

  /** Баланс ДО операции */
  @AllowNull(false)
  @Column(DataType.BIGINT)
  declare balance_before: number;

  /** Баланс ПОСЛЕ операции */
  @AllowNull(false)
  @Column(DataType.BIGINT)
  declare balance_after: number;

  @AllowNull(true)
  @Column(DataType.STRING(512))
  declare description: string | null;

  /** Код модуля (при списании за модуль) */
  @AllowNull(true)
  @Column(DataType.STRING(64))
  declare module_code: string | null;

  /** FK → users.uniqueid (superadmin who performed the operation) */
  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare performed_by: number | null;

  // ── Bank webhook ─────────────────────────────────────────────────────────────

  /** ID транзакции банка — idempotency key для дедупликации */
  @Unique
  @AllowNull(true)
  @Column(DataType.STRING(128))
  declare external_id: string | null;

  /** Порядковый номер документа в текущем году */
  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare doc_number: number | null;

  // ── Accounting provider ──────────────────────────────────────────────────────

  /** Идентификатор документа у бухгалтерского провайдера (СБИС и др.) */
  @AllowNull(true)
  @Column(DataType.STRING(128))
  declare sbis_id: string | null;

  /** Публичная ссылка на закрывающий документ для клиента */
  @AllowNull(true)
  @Column(DataType.TEXT)
  declare sbis_url: string | null;

  /** Статус создания закрывающего документа */
  @AllowNull(true)
  @Column(DataType.ENUM('pending', 'done', 'failed'))
  declare sbis_status: SbisStatus | null;

  /** Номер документа в системе провайдера */
  @AllowNull(true)
  @Column(DataType.STRING(64))
  declare sbis_doc_num: string | null;

  @Default(DataType.NOW)
  @Column(DataType.DATE)
  declare created_at: Date;
}
