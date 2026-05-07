import {
  Table, Column, Model, DataType, PrimaryKey, AutoIncrement, Default,
} from 'sequelize-typescript';

/**
 * Stores failed webhook deliveries after all BullMQ retry attempts exhausted.
 *
 * DDL (run once on server):
 * CREATE TABLE webhook_failures (
 *   id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 *   route_uid   VARCHAR(64)  NOT NULL,
 *   event       VARCHAR(32)  NOT NULL,
 *   url         VARCHAR(512) NOT NULL,
 *   payload     JSON         NOT NULL,
 *   headers     JSON         NOT NULL,
 *   error       TEXT,
 *   attempts    TINYINT UNSIGNED DEFAULT 3,
 *   failed_at   DATETIME DEFAULT NOW(),
 *   retried_at  DATETIME NULL,
 *   resolved    TINYINT(1) DEFAULT 0
 * ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
 */
@Table({ tableName: 'webhook_failures', timestamps: false, freezeTableName: true })
export class WebhookFailure extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER.UNSIGNED })
  declare id: number;

  /** Route UID from HH_ROUTE_UID dialplan variable */
  @Column({ type: DataType.STRING(64), allowNull: false })
  declare route_uid: string;

  /** Webhook event type: before_dial | on_answer | on_hangup | custom */
  @Column({ type: DataType.STRING(32), allowNull: false })
  declare event: string;

  /** Target URL that failed */
  @Column({ type: DataType.STRING(512), allowNull: false })
  declare url: string;

  /** Full payload that was sent (for retry) */
  @Column({ type: DataType.JSON, allowNull: false })
  declare payload: Record<string, any>;

  /** Pre-built headers (auth, signature) serialized for retry */
  @Column({ type: DataType.JSON, allowNull: false })
  declare headers: Record<string, string>;

  /** Last error message from the final failed attempt */
  @Column({ type: DataType.TEXT, allowNull: true })
  declare error: string | null;

  /** Number of attempts made before landing here */
  @Default(3)
  @Column({ type: DataType.TINYINT.UNSIGNED })
  declare attempts: number;

  @Column({ type: DataType.DATE, field: 'failed_at', defaultValue: DataType.NOW })
  declare failed_at: Date;

  /** Set when admin manually retried this record */
  @Column({ type: DataType.DATE, field: 'retried_at', allowNull: true })
  declare retried_at: Date | null;

  /** True once successfully re-delivered or manually dismissed */
  @Default(false)
  @Column({ type: DataType.BOOLEAN })
  declare resolved: boolean;
}
