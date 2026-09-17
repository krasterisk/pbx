import {
  Table, Column, Model, DataType, PrimaryKey, AutoIncrement, Default, ForeignKey,
} from 'sequelize-typescript';
import type { AutodialScheduleKind } from '@krasterisk/shared';
import { AcCampaign } from './ac-campaign.model';

@Table({
  tableName: 'ac_schedules',
  timestamps: false,
  freezeTableName: true,
})
export class AcSchedule extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare uid: number;

  @ForeignKey(() => AcCampaign)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare campaign_uid: number;

  @Default('weekly')
  @Column({ type: DataType.STRING(16), allowNull: false })
  declare kind: AutodialScheduleKind;

  @Column({ type: DataType.TINYINT, allowNull: true })
  declare weekday: number | null;

  @Default('09:00')
  @Column({ type: DataType.STRING(5), allowNull: false })
  declare time_from: string;

  @Default('21:00')
  @Column({ type: DataType.STRING(5), allowNull: false })
  declare time_to: string;

  @Default('Europe/Moscow')
  @Column({ type: DataType.STRING(64), allowNull: false })
  declare timezone: string;

  @Column({ type: DataType.DATEONLY, allowNull: true })
  declare date_from: string | null;

  @Column({ type: DataType.DATEONLY, allowNull: true })
  declare date_to: string | null;

  @Default(true)
  @Column({ type: DataType.BOOLEAN, allowNull: false })
  declare enabled: boolean;
}
