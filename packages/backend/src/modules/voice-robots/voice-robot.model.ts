import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, Default } from 'sequelize-typescript';

@Table({ tableName: 'voice_robots', timestamps: false, freezeTableName: true })
export class VoiceRobot extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  declare uid: number;

  @Column({ type: DataType.STRING(255), allowNull: false })
  declare name: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare description: string | null;

  @Default(1)
  @Column({ type: DataType.TINYINT, allowNull: false })
  declare active: number;

  @Default('ru-RU')
  @Column({ type: DataType.STRING(16), allowNull: false })
  declare language: string;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare stt_engine_id: number | null;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare tts_engine_id: number | null;

  @Column({ type: DataType.JSON, allowNull: true })
  declare greeting_prompts: any | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare greeting_tts_text: string | null;

  @Column({ type: DataType.JSON, allowNull: true })
  declare vad_config: any | null;

  @Column({ type: DataType.JSON, allowNull: true })
  declare fallback_action: any | null;

  @Column({ type: DataType.JSON, allowNull: true })
  declare max_retries_action: any | null;

  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare max_conversation_steps: number;

  @Column({ type: DataType.STRING(512), allowNull: true })
  declare webhook_url: string | null;

  @Default('POST')
  @Column({ type: DataType.STRING(8), allowNull: false })
  declare webhook_method: string;

  @Column({ type: DataType.STRING(128), allowNull: true })
  declare telegram_chat_id: string | null;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare email_notify: string | null;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare external_host: string | null;

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
