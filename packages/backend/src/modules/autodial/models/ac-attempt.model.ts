import {
  Table, Column, Model, DataType, PrimaryKey, AutoIncrement, Default, ForeignKey,
} from 'sequelize-typescript';
import type { AutodialDisposition } from '@krasterisk/shared';
import { AcTask } from './ac-task.model';
import { AcCampaign } from './ac-campaign.model';

@Table({
  tableName: 'ac_attempts',
  timestamps: false,
  freezeTableName: true,
})
export class AcAttempt extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false, field: 'vpbx_user_uid' })
  declare user_uid: number;

  @ForeignKey(() => AcTask)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare task_uid: number;

  @ForeignKey(() => AcCampaign)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare campaign_uid: number;

  @Default(1)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare attempt_no: number;

  @Column({ type: DataType.DATE, allowNull: false })
  declare started_at: Date;

  @Column({ type: DataType.DATE, allowNull: true })
  declare answered_at: Date | null;

  @Column({ type: DataType.DATE, allowNull: true })
  declare ended_at: Date | null;

  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare duration: number;

  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare billsec: number;

  @Default('dialing')
  @Column({ type: DataType.STRING(24), allowNull: false })
  declare disposition: AutodialDisposition;

  @Column({ type: DataType.STRING(64), allowNull: true })
  declare hangup_cause: string | null;

  @Column({ type: DataType.STRING(128), allowNull: true })
  declare trunk_id: string | null;

  @Column({ type: DataType.STRING(64), allowNull: true })
  declare caller_id: string | null;

  @Column({ type: DataType.STRING(128), allowNull: true })
  declare channel_id: string | null;

  @Column({ type: DataType.STRING(64), allowNull: true })
  declare uniqueid: string | null;

  @Column({ type: DataType.STRING(64), allowNull: true })
  declare linkedid: string | null;

  @Column({ type: DataType.STRING(32), allowNull: true })
  declare amd_result: string | null;

  @Column({ type: DataType.STRING(128), allowNull: true })
  declare queue_name: string | null;

  @Column({ type: DataType.STRING(128), allowNull: true })
  declare agent_interface: string | null;

  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare talk_sec: number;

  @Column({ type: DataType.JSON, allowNull: true })
  declare scenario_result: Record<string, unknown> | null;
}
