import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, Default, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { VoiceRobotKeywordGroup } from './keyword-group.model';

@Table({ tableName: 'voice_robot_keywords', timestamps: false, freezeTableName: true })
export class VoiceRobotKeyword extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  declare uid: number;

  @ForeignKey(() => VoiceRobotKeywordGroup)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare group_id: number;

  @BelongsTo(() => VoiceRobotKeywordGroup, { onDelete: 'CASCADE' })
  declare group: VoiceRobotKeywordGroup;

  @Column({ type: DataType.TEXT, allowNull: false })
  declare keywords: string;

  @Column({ type: DataType.JSON, allowNull: true })
  declare negative_keywords: any | null;

  @Column({ type: DataType.JSON, allowNull: true })
  declare synonyms: any | null;

  @Column({ type: DataType.JSON, allowNull: true })
  declare actions: any | null;

  @Column({ type: DataType.JSON, allowNull: true })
  declare bot_action: any | null;

  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare priority: number;

  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare max_repeats: number;

  @Column({ type: DataType.JSON, allowNull: true })
  declare escalation_action: any | null;

  @Column({ type: DataType.STRING(512), allowNull: true })
  declare comment: string | null;

  /** Custom tag — if set, used in visitedTags instead of group name */
  @Column({ type: DataType.STRING(255), allowNull: true })
  declare tag: string | null;

  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare user_uid: number;
}
