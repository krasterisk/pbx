import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, Default, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { VoiceRobot } from './voice-robot.model';

@Table({ tableName: 'voice_robot_keyword_groups', timestamps: false, freezeTableName: true })
export class VoiceRobotKeywordGroup extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  declare uid: number;

  @ForeignKey(() => VoiceRobot)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare robot_id: number;

  @BelongsTo(() => VoiceRobot, { onDelete: 'CASCADE' })
  declare robot: VoiceRobot;

  @Column({ type: DataType.STRING(255), allowNull: false })
  declare name: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare description: string | null;

  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare priority: number;

  @Default(1)
  @Column({ type: DataType.TINYINT, allowNull: false })
  declare active: number;

  @Default(0)
  @Column({ type: DataType.TINYINT, allowNull: false })
  declare is_global: number;

  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare user_uid: number;
}
