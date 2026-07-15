import { Column, DataType, Model, Table } from 'sequelize-typescript';

/**
 * Tenant-scoped notification channel integration (D-10).
 *
 * Non-secret defaults live in `config`; API tokens / keys are stored in
 * `encrypted_credentials` (AES-256-GCM via encryptSecret).
 */
@Table({ tableName: 'notification_integrations', timestamps: false })
export class NotificationIntegration extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
  declare uid: number;

  @Column({ type: DataType.STRING(128), allowNull: false })
  declare name: string;

  @Column({
    type: DataType.ENUM('telegram', 'email', 'whatsapp', 'webhook', 'max', 'vk'),
    allowNull: false,
  })
  declare channel: 'telegram' | 'email' | 'whatsapp' | 'webhook' | 'max' | 'vk';

  /** Non-secret channel defaults (chat_id, webhook URL template, etc.). */
  @Column({ type: DataType.JSON, allowNull: true })
  declare config: Record<string, any> | null;

  /** Encrypted JSON credentials blob (AES-256-GCM, CC_AI_KEY_SECRET). */
  @Column({ type: DataType.TEXT, allowNull: true })
  declare encrypted_credentials: string | null;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare user_uid: number;
}
