import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, Default } from 'sequelize-typescript';

/**
 * ServiceRequest — таблица обращений клиентов (клиентская база call-центра).
 *
 * Каждая запись = одно обращение (заявка), с которым работает оператор.
 * В отличие от voice_robot_logs (пошаговый лог робота, несколько записей на 1 звонок),
 * здесь 1 запись = 1 обращение/заявка.
 *
 * Связь с voice_robot_logs: по полю call_uniqueid (Asterisk Unique-ID звонка).
 */
@Table({ tableName: 'service_requests', timestamps: false, freezeTableName: true })
export class ServiceRequest extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT })
  declare uid: number;

  // ─── Оператор и звонок ────────────────────────────────

  /** Оператор Call-центра, принявший звонок (FK → users.uid) */
  @Column({ type: DataType.INTEGER, allowNull: true })
  declare operator_id: number | null;

  /** Дата/время поступления звонка */
  @Column({ type: DataType.DATE, allowNull: false })
  declare call_received_at: Date;

  /** Asterisk Unique-ID звонка — связь с CDR и voice_robot_logs */
  @Column({ type: DataType.STRING(128), allowNull: true })
  declare call_uniqueid: string | null;

  /** Идентификатор звонка / номер заявки (человекочитаемый, генерируется системой) */
  @Column({ type: DataType.STRING(64), allowNull: true, unique: true })
  declare request_number: string | null;

  // ─── Контрагент ───────────────────────────────────────

  /** Тип контрагента: физлицо или юрлицо */
  @Default('individual')
  @Column({ type: DataType.STRING(20), allowNull: false })
  declare counterparty_type: 'individual' | 'legal';

  /** Контрагент: ФИО физлица / наименование юрлица */
  @Column({ type: DataType.STRING(512), allowNull: true })
  declare counterparty_name: string | null;

  /** Лицевой счёт (для физлиц) или ИНН (для юрлиц) */
  @Column({ type: DataType.STRING(64), allowNull: true })
  declare account_or_inn: string | null;

  /** Телефон контрагента */
  @Column({ type: DataType.STRING(32), allowNull: true })
  declare phone: string | null;

  // ─── Адрес и территория ───────────────────────────────

  /** Территориальная зона (справочник — вторая вкладка) */
  @Column({ type: DataType.STRING(128), allowNull: true })
  declare territorial_zone: string | null;

  /** Населённый пункт */
  @Column({ type: DataType.STRING(255), allowNull: true })
  declare locality: string | null;

  /** Район (тег — используется для назначения инженеров) */
  @Column({ type: DataType.STRING(128), allowNull: true })
  declare district: string | null;

  /** Полный адрес */
  @Column({ type: DataType.STRING(512), allowNull: true })
  declare address: string | null;

  // ─── Суть обращения ───────────────────────────────────

  /** Тема обращения (тег) */
  @Column({ type: DataType.STRING(128), allowNull: true })
  declare topic: string | null;

  /** Комментарий по сути звонка (описание проблемы) */
  @Column({ type: DataType.TEXT, allowNull: true })
  declare comment: string | null;

  // ─── Исполнение и статусы ─────────────────────────────

  /** Комментарий для ответа по срокам вывоза */
  @Column({ type: DataType.TEXT, allowNull: true })
  declare schedule_comment: string | null;

  /**
   * Статус отправки СМС:
   * - not_sent:   СМС не отправлялось
   * - sent:       СМС отправлено (с запланированной датой)
   * - delivered:  СМС доставлено
   * - failed:     Ошибка отправки
   */
  @Default('not_sent')
  @Column({ type: DataType.STRING(20), allowNull: false })
  declare sms_status: 'not_sent' | 'sent' | 'delivered' | 'failed';

  /** Дата запланированного вывоза (из СМС) */
  @Column({ type: DataType.DATE, allowNull: true })
  declare scheduled_date: Date | null;

  /**
   * Статус выполнения заявки:
   * - new:         Новая (ещё не в работе)
   * - in_progress: В работе
   * - completed:   Выполнено
   * - postponed:   Перенесено
   * - impossible:  Невозможно выполнить
   */
  @Default('new')
  @Column({ type: DataType.STRING(20), allowNull: false })
  declare request_status: 'new' | 'in_progress' | 'completed' | 'postponed' | 'impossible';

  // ─── Мультитенантность и метаданные ───────────────────

  /** Tenant ID (vpbx_user_uid) — изоляция данных по тенантам */
  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare user_uid: number;

  @Default(DataType.NOW)
  @Column({ type: DataType.DATE, field: 'created_at' })
  declare created_at: Date;

  @Default(DataType.NOW)
  @Column({ type: DataType.DATE, field: 'updated_at' })
  declare updated_at: Date;
}
