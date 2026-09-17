import {
  Table, Column, Model, DataType, PrimaryKey, AutoIncrement, Default, ForeignKey,
} from 'sequelize-typescript';
import { AcCampaign } from './ac-campaign.model';

@Table({
  tableName: 'ac_daily_campaign_stats',
  timestamps: false,
  freezeTableName: true,
})
export class AcDailyCampaignStats extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false, field: 'vpbx_user_uid' })
  declare user_uid: number;

  @ForeignKey(() => AcCampaign)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare campaign_uid: number;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  declare day: string;

  @Default(0) @Column({ type: DataType.INTEGER, allowNull: false }) declare dials: number;
  @Default(0) @Column({ type: DataType.INTEGER, allowNull: false }) declare answered: number;
  @Default(0) @Column({ type: DataType.INTEGER, allowNull: false }) declare success: number;
  @Default(0) @Column({ type: DataType.INTEGER, allowNull: false }) declare short: number;
  @Default(0) @Column({ type: DataType.INTEGER, allowNull: false }) declare no_answer: number;
  @Default(0) @Column({ type: DataType.INTEGER, allowNull: false }) declare busy: number;
  @Default(0) @Column({ type: DataType.INTEGER, allowNull: false }) declare amd: number;
  @Default(0) @Column({ type: DataType.INTEGER, allowNull: false }) declare failed: number;
  @Default(0) @Column({ type: DataType.INTEGER, allowNull: false }) declare talk_sec_sum: number;
  @Default(0) @Column({ type: DataType.INTEGER, allowNull: false }) declare billsec_sum: number;
}
