import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, Default } from 'sequelize-typescript';

/**
 * VoiceRobotCdr — CDR (Call Detail Record) голосового робота.
 *
 * 1 запись = 1 звонок (в отличие от voice_robot_logs, где 1 звонок = N шагов).
 * Содержит сводную информацию: кто звонил, сколько длился диалог,
 * чем закончился, сколько шагов прошёл.
 *
 * Создаётся при завершении сессии (cleanup).
 */
@Table({ tableName: 'voice_robot_cdr', timestamps: false, freezeTableName: true })
export class VoiceRobotCdr extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT })
  declare uid: number;

  // ─── Идентификация звонка ─────────────────────────────

  /** FK → voice_robots.uid */
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare robot_id: number;

  /** Имя робота (кэшированное на момент звонка) */
  @Column({ type: DataType.STRING(255), allowNull: true })
  declare robot_name: string | null;

  /** Asterisk Unique-ID (связь с CDR Asterisk и voice_robot_logs) */
  @Column({ type: DataType.STRING(128), allowNull: true })
  declare call_uniqueid: string | null;

  /** ARI Channel ID */
  @Column({ type: DataType.STRING(255), allowNull: true })
  declare channel_id: string | null;

  /** UUID сессии робота */
  @Column({ type: DataType.STRING(255), allowNull: true })
  declare session_id: string | null;

  // ─── Вызывающий ───────────────────────────────────────

  /** Номер звонящего (CallerID num) */
  @Column({ type: DataType.STRING(64), allowNull: true })
  declare caller_id: string | null;

  /** Имя звонящего (CallerID name) */
  @Column({ type: DataType.STRING(128), allowNull: true })
  declare caller_name: string | null;

  // ─── Временные метки ──────────────────────────────────

  /** Время начала звонка (ответ робота) */
  @Column({ type: DataType.DATE, allowNull: false })
  declare started_at: Date;

  /** Время завершения звонка */
  @Column({ type: DataType.DATE, allowNull: true })
  declare ended_at: Date | null;

  /** Длительность диалога (секунды) */
  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare duration_seconds: number;

  // ─── Результат ────────────────────────────────────────

  /**
   * Итог звонка:
   * - completed:       Нормальное завершение (transfer/hangup по сценарию)
   * - caller_hangup:   Звонящий повесил трубку
   * - fallback:        Сработал fallback (не распознано / max retries)
   * - max_steps:       Превышен лимит шагов
   * - error:           Техническая ошибка
   * - timeout:         Таймаут по неактивности
   */
  @Default('completed')
  @Column({ type: DataType.STRING(32), allowNull: false })
  declare disposition: 'completed' | 'caller_hangup' | 'fallback' | 'max_steps' | 'error' | 'timeout';

  /** Последнее действие робота (transfer_exten, hangup, webhook, etc.) */
  @Column({ type: DataType.STRING(64), allowNull: true })
  declare last_action: string | null;

  /** Целевой номер перевода (если был transfer) */
  @Column({ type: DataType.STRING(128), allowNull: true })
  declare transfer_target: string | null;

  // ─── Статистика диалога ───────────────────────────────

  /** Количество шагов FSM */
  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare total_steps: number;

  /** Количество сработавших ключевых слов */
  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare matched_keywords_count: number;

  /** Количество промахов (no_match) */
  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare no_match_count: number;

  /** Средняя уверенность совпадений */
  @Column({ type: DataType.DECIMAL(5, 2), allowNull: true })
  declare avg_confidence: number | null;

  /** Собранные слоты (JSON) — итоговые данные, собранные во время диалога */
  @Column({ type: DataType.JSON, allowNull: true })
  declare collected_slots: any | null;

  /** Полный текст диалога (STT + TTS) для быстрого просмотра */
  @Column({ type: DataType.TEXT, allowNull: true })
  declare transcript: string | null;

  /** Теги (JSON-массив) — имена групп ключевых слов, через которые прошёл диалог */
  @Column({ type: DataType.JSON, allowNull: true })
  declare tags: string[] | null;

  // ─── Мультитенантность ────────────────────────────────

  /** Tenant ID (vpbx_user_uid) */
  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare user_uid: number;
}
