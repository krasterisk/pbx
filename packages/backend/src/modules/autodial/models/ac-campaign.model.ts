import {
  Table, Column, Model, DataType, PrimaryKey, AutoIncrement,
  CreatedAt, UpdatedAt, Default, ForeignKey,
} from 'sequelize-typescript';
import type {
  AutodialCampaignStatus,
  AutodialDialMode,
  IAutodialAmdConfig,
  IAutodialCidPolicy,
  IAutodialPacingConfig,
  IAutodialRetryConfig,
  IAutodialTrunkPoolItem,
  IRouteAction,
} from '@krasterisk/shared';
import { AcBase } from './ac-base.model';

@Table({
  tableName: 'ac_campaigns',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  freezeTableName: true,
})
export class AcCampaign extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false, field: 'vpbx_user_uid' })
  declare user_uid: number;

  @Column({ type: DataType.STRING(255), allowNull: false })
  declare name: string;

  @Default('draft')
  @Column({ type: DataType.STRING(16), allowNull: false })
  declare status: AutodialCampaignStatus;

  @Default('progressive')
  @Column({ type: DataType.STRING(16), allowNull: false })
  declare dial_mode: AutodialDialMode;

  @ForeignKey(() => AcBase)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare base_uid: number;

  @Column({ type: DataType.JSON, allowNull: false })
  declare pacing: IAutodialPacingConfig;

  @Column({ type: DataType.JSON, allowNull: false })
  declare retry: IAutodialRetryConfig;

  @Column({ type: DataType.JSON, allowNull: false })
  declare trunk_pool: IAutodialTrunkPoolItem[];

  @Column({ type: DataType.JSON, allowNull: false })
  declare cid_policy: IAutodialCidPolicy;

  @Column({ type: DataType.JSON, allowNull: false })
  declare queue_names: string[];

  @Column({ type: DataType.JSON, allowNull: false })
  declare scenario_actions: IRouteAction[];

  @Column({ type: DataType.JSON, allowNull: false })
  declare amd: IAutodialAmdConfig;

  @Default(15)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare success_min_sec: number;

  @Default(45)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare dial_timeout_sec: number;

  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare revision: number;

  /** Last campaign revision whose dialplan apply succeeded. Null = never applied. */
  @Column({ type: DataType.INTEGER, allowNull: true })
  declare applied_revision: number | null;

  /** Last dialplan apply failure code/message. Null when apply succeeded. */
  @Column({ type: DataType.STRING(255), allowNull: true })
  declare apply_error: string | null;

  /** Worker currently allowed to pace this campaign; CAS heartbeat fencing. */
  @Column({ type: DataType.STRING(64), allowNull: true })
  declare pacer_owner: string | null;

  @Column({ type: DataType.DATE, allowNull: true })
  declare pacer_heartbeat_at: Date | null;

  @CreatedAt
  declare created_at: Date;

  @UpdatedAt
  declare updated_at: Date;
}
