import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, Default } from 'sequelize-typescript';

@Table({ tableName: 'voice_robot_logs', timestamps: false, freezeTableName: true })
export class VoiceRobotLog extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT })
  declare uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare robot_id: number;

  @Column({ type: DataType.STRING(128), allowNull: true })
  declare call_uniqueid: string | null;

  @Column({ type: DataType.STRING(64), allowNull: true })
  declare caller_id: string | null;

  @Default(1)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare step_number: number;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare recognized_text: string | null;

  @Column({ type: DataType.JSON, allowNull: true })
  declare raw_stt_json: any | null;

  @Column({ type: DataType.STRING(512), allowNull: true })
  declare audio_file_path: string | null;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare matched_keyword_id: number | null;

  @Default(0)
  @Column({ type: DataType.DECIMAL(5, 2), allowNull: true })
  declare match_confidence: number | null;

  @Column({ type: DataType.STRING(512), allowNull: true })
  declare action_taken: string | null;

  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: true })
  declare stt_duration_ms: number | null;

  @Default(DataType.NOW)
  @Column({ type: DataType.DATE, field: 'timestamp' })
  declare timestamp: Date;

  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare user_uid: number;
}
