import { Column, DataType, Model, Table } from 'sequelize-typescript';

/**
 * AI Provider profile — a reusable connection config for a vendor
 * (OpenAI Realtime, Qwen, Yandex SpeechKit, Ollama, custom HTTP/WS, …).
 *
 * `user_uid` is the owning tenant. `is_global` rows belong to the superadmin catalog.
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

  /** Versioned AES-GCM envelope; legacy ciphertext remains readable with an explicit key. */
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

  /** Platform catalog row. Hidden from tenant provider lists. */
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  declare is_global: boolean;

  // Tenant isolation (`vpbx_user_uid`). 0 is a valid BOX tenant, not a template.
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;
}
