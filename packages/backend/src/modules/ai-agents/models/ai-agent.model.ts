import { Column, DataType, Model, Table } from 'sequelize-typescript';

/**
 * AI Agent — the main "operator" entity. References 1–3 provider profiles
 * (LLM/STT/TTS) plus a toolset, and lives in queues like a human agent.
 *
 * `mode='realtime'` uses speech-to-speech via the LLM provider directly,
 * `mode='cascade'` runs VAD → STT → LLM → TTS chain.
 */
@Table({ tableName: 'cc_ai_agents', timestamps: false })
export class CcAiAgent extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
  declare uid: number;

  @Column({ type: DataType.STRING(128), allowNull: false })
  declare name: string;

  /** Stable identifier used as the dialplan extension / queue member tag. */
  @Column({ type: DataType.STRING(64), allowNull: false })
  declare unique_id: string;

  @Column({
    type: DataType.ENUM('realtime', 'cascade'),
    allowNull: false,
    defaultValue: 'realtime',
  })
  declare mode: 'realtime' | 'cascade';

  @Column({ type: DataType.STRING(64), allowNull: true, defaultValue: '' })
  declare voice: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare greeting: string;

  @Column({ type: DataType.TEXT('medium'), allowNull: true })
  declare instruction: string;

  /** → cc_ai_providers (LLM or realtime endpoint). */
  @Column({ type: DataType.INTEGER, allowNull: true })
  declare model_profile_id: number;

  /** → cc_ai_providers (STT — required for cascade). */
  @Column({ type: DataType.INTEGER, allowNull: true })
  declare stt_profile_id: number;

  /** → cc_ai_providers (TTS — required for cascade). */
  @Column({ type: DataType.INTEGER, allowNull: true })
  declare tts_profile_id: number;

  /** {threshold, silenceMs, minSpeechMs, …} */
  @Column({ type: DataType.JSON, allowNull: true })
  declare vad_config: Record<string, any>;

  /** → cc_ai_toolsets */
  @Column({ type: DataType.INTEGER, allowNull: true })
  declare toolset_id: number;

  @Column({
    type: DataType.ENUM('local', 'pjsip'),
    allowNull: false,
    defaultValue: 'local',
  })
  declare channel_kind: 'local' | 'pjsip';

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare enabled: boolean;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare created_at: Date;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
    onUpdate: 'CURRENT_TIMESTAMP' as any,
  })
  declare updated_at: Date;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;
}
