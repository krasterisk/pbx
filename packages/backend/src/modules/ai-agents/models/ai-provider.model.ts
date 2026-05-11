import { Column, DataType, Model, Table } from 'sequelize-typescript';

/**
 * AI Provider profile — a reusable connection config for a vendor
 * (OpenAI Realtime, Qwen, Yandex SpeechKit, Ollama, custom HTTP/WS, …).
 *
 * `user_uid = 0` means a global template (admin-installed), tenants can
 * clone & override secrets/pricing.
 */
@Table({ tableName: 'cc_ai_providers', timestamps: false })
export class CcAiProvider extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
  declare uid: number;

  @Column({ type: DataType.STRING(128), allowNull: false })
  declare name: string;

  @Column({ type: DataType.ENUM('online', 'local', 'custom'), allowNull: false })
  declare kind: 'online' | 'local' | 'custom';

  @Column({ type: DataType.STRING(32), allowNull: false })
  declare vendor: string;

  @Column({ type: DataType.STRING(512), allowNull: false })
  declare endpoint: string;

  @Column({
    type: DataType.ENUM('bearer', 'api_key_header', 'none', 'custom'),
    allowNull: true,
    defaultValue: 'bearer',
  })
  declare auth_type: 'bearer' | 'api_key_header' | 'none' | 'custom';

  /** Encrypted API key (AES-256, key from .env CC_AI_KEY_SECRET). */
  @Column({ type: DataType.TEXT, allowNull: true })
  declare encrypted_api_key: string;

  /** ["llm","stt","tts","realtime"] */
  @Column({ type: DataType.JSON, allowNull: false })
  declare capabilities: string[];

  /** {model, voice, language, temperature, …} */
  @Column({ type: DataType.JSON, allowNull: true })
  declare defaults: Record<string, any>;

  /** {inputTokenUsd, outputTokenUsd, audioMinuteUsd, …} */
  @Column({ type: DataType.JSON, allowNull: false })
  declare pricing: Record<string, any>;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare enabled: boolean;

  // Tenant isolation. 0 = global template
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;
}
