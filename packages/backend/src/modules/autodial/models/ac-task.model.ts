import {
  Table, Column, Model, DataType, PrimaryKey, AutoIncrement,
  CreatedAt, UpdatedAt, Default, ForeignKey,
} from 'sequelize-typescript';
import type { AutodialDisposition, AutodialTaskStatus } from '@krasterisk/shared';
import { AcCampaign } from './ac-campaign.model';

@Table({
  tableName: 'ac_tasks',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  freezeTableName: true,
})
export class AcTask extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false, field: 'vpbx_user_uid' })
  declare user_uid: number;

  @ForeignKey(() => AcCampaign)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare campaign_uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare contact_uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare phone_uid: number;

  @Default('pending')
  @Column({ type: DataType.STRING(16), allowNull: false })
  declare status: AutodialTaskStatus;

  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare attempt_count: number;

  @Column({ type: DataType.DATE, allowNull: true })
  declare next_attempt_at: Date | null;

  @Default('new')
  @Column({ type: DataType.STRING(24), allowNull: false })
  declare last_disposition: AutodialDisposition;

  @Column({ type: DataType.STRING(64), allowNull: true })
  declare last_cause: string | null;

  @Column({ type: DataType.STRING(64), allowNull: true })
  declare leased_by: string | null;

  @Column({ type: DataType.DATE, allowNull: true })
  declare leased_at: Date | null;

  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare priority: number;

  @CreatedAt
  declare created_at: Date;

  @UpdatedAt
  declare updated_at: Date;
}
