import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement } from 'sequelize-typescript';

/**
 * Per-tenant AI Chat confirmation settings (D-25): NOT global cloud_settings —
 * each vpbx_user tenant controls its own destructive-operation confirmation gate.
 * Default OFF (confirm_destructive = 0). Table created by
 * phonebooks/migrate-phonebooks-phase5.ts.
 */
@Table({ tableName: 'ai_chat_settings', timestamps: false, freezeTableName: true })
export class AiChatSettings extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  declare uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false, unique: true })
  declare user_uid: number;

  @Column({ type: DataType.TINYINT, allowNull: false, defaultValue: 0 })
  declare confirm_destructive: number;

  @Column({ type: DataType.JSON, allowNull: true, defaultValue: null })
  declare settings: Record<string, any> | null;

  @Column({ type: DataType.DATE, field: 'created_at' })
  declare created_at: Date;

  @Column({ type: DataType.DATE, field: 'updated_at' })
  declare updated_at: Date;
}
