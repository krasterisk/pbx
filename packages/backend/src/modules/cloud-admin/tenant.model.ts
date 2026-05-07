import {
  Table, Column, Model, DataType,
  PrimaryKey, AutoIncrement, Default, AllowNull,
} from 'sequelize-typescript';

export type TenantStatus = 'trial' | 'active' | 'suspended' | 'cancelled';

@Table({ tableName: 'tenants', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' })
export class Tenant extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  declare id: number;

  /** UUID кабинета — публичный идентификатор */
  @AllowNull(false)
  @Column({ type: DataType.STRING(36) })
  declare uid: string;

  /** Название организации тенанта */
  @AllowNull(false)
  @Column({ type: DataType.STRING(255) })
  declare name: string;

  /** Slug (subdomain) — уникальный короткий идентификатор */
  @Column({ type: DataType.STRING(128), allowNull: true })
  declare slug: string | null;

  /**
   * ID root-пользователя (Tenant Admin).
   * FK → users.uniqueid
   */
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare owner_user_id: number;

  /**
   * Ключевое поле совместимости:
   * vpbx_user_uid = owner_user_id
   * Все существующие модули фильтруют данные по этому полю.
   */
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare vpbx_user_uid: number;

  /** Текущий статус кабинета */
  @Default('trial')
  @Column({ type: DataType.ENUM('trial', 'active', 'suspended', 'cancelled') })
  declare status: TenantStatus;

  /** Дата окончания триального периода */
  @Column({ type: DataType.DATE, allowNull: true })
  declare trial_ends_at: Date | null;

  /** Контактный email */
  @Column({ type: DataType.STRING(255), allowNull: true })
  declare email: string | null;

  /** Контактный телефон */
  @Column({ type: DataType.STRING(32), allowNull: true })
  declare phone: string | null;

  /** ИНН организации */
  @Column({ type: DataType.STRING(32), allowNull: true })
  declare company_inn: string | null;

  /** Лимит: максимум внутренних номеров */
  @Default(10)
  @Column({ type: DataType.INTEGER })
  declare max_extensions: number;

  /** Лимит: максимум транков */
  @Default(2)
  @Column({ type: DataType.INTEGER })
  declare max_trunks: number;

  /** Лимит: максимум очередей */
  @Default(3)
  @Column({ type: DataType.INTEGER })
  declare max_queues: number;

  /** Кто создал (superadmin user id) */
  @Column({ type: DataType.INTEGER, allowNull: true })
  declare created_by: number | null;

  declare created_at: Date;
  declare updated_at: Date;
}
