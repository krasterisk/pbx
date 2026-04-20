import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, Default } from 'sequelize-typescript';

/**
 * VoiceRobotLog — пошаговый лог работы голосового робота.
 *
 * Каждая строка = 1 шаг FSM (распознавание + совпадение + действие).
 * За один звонок создаётся несколько записей.
 *
 * Связь с VoiceRobotCdr: по call_uniqueid (Asterisk Unique-ID).
 */
@Table({ tableName: 'voice_robot_logs', timestamps: false, freezeTableName: true })
export class VoiceRobotLog extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  declare uid: number;

  /** FK → voice_robots.uid */
  @Column({ type: DataType.INTEGER, allowNull: true })
  declare robot_id: number | null;

  /** Asterisk Unique-ID звонка (связь с CDR) */
  @Column({ type: DataType.STRING(128), allowNull: true })
  declare call_uniqueid: string | null;

  /** UUID сессии робота (уникальный на каждый запуск) */
  @Column({ type: DataType.STRING(255), allowNull: true })
  declare session_id: string | null;

  /** ARI Channel ID */
  @Column({ type: DataType.STRING(255), allowNull: true })
  declare channel_id: string | null;

  /** Номер звонящего (CallerID num) */
  @Column({ type: DataType.STRING(255), allowNull: true })
  declare caller_id: string | null;

  /** Порядковый номер шага в диалоге */
  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare step_number: number;

  /** ID группы ключевых слов, в которой сработало совпадение */
  @Column({ type: DataType.INTEGER, allowNull: true })
  declare matched_group_id: number | null;

  /** Распознанный текст (STT) */
  @Column({ type: DataType.TEXT, allowNull: true })
  declare recognized_text: string | null;

  /** Полный JSON-ответ STT */
  @Column({ type: DataType.JSON, allowNull: true })
  declare raw_stt_json: any | null;

  /** Путь к аудиофайлу шага */
  @Column({ type: DataType.STRING(512), allowNull: true })
  declare audio_file_path: string | null;

  /** ID сработавшего ключевого слова */
  @Column({ type: DataType.INTEGER, allowNull: true })
  declare matched_keyword_id: number | null;

  /** Уверенность совпадения (0.00–1.00) */
  @Column({ type: DataType.DECIMAL(5, 2), allowNull: true })
  declare match_confidence: number | null;

  /** Описание выполненного действия */
  @Column({ type: DataType.STRING(512), allowNull: true })
  declare action_taken: string | null;

  /** Длительность STT-распознавания (ms) */
  @Column({ type: DataType.INTEGER, allowNull: true })
  declare stt_duration_ms: number | null;

  /** Скор семантического сопоставления (float) */
  @Column({ type: DataType.FLOAT, allowNull: true })
  declare matching_score: number | null;

  /** Длительность шага (ms) — от начала речи до выполнения действия */
  @Column({ type: DataType.INTEGER, allowNull: true })
  declare duration_ms: number | null;

  /** Ответ робота (TTS-текст, произнесённый после этого шага) */
  @Column({ type: DataType.TEXT, allowNull: true })
  declare ai_response: string | null;

  /** JSON с описанием навигации FSM (nextState, target, slots) */
  @Column({ type: DataType.JSON, allowNull: true })
  declare flow_action: any | null;

  /** Tenant ID (vpbx_user_uid) */
  @Column({ type: DataType.INTEGER, allowNull: true })
  declare user_uid: number | null;

  /** Время шага */
  @Column({ type: DataType.DATE, allowNull: true, field: 'timestamp' })
  declare timestamp: Date | null;
}
