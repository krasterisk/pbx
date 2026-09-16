import { Column, DataType, Model, Table } from 'sequelize-typescript';

/**
 * Historical record of a held conference meeting.
 * Completeness is `ended_at IS NULL`; Sequelize timestamps stay off.
 */
@Table({ tableName: 'conference_meetings', timestamps: false, freezeTableName: true })
export class ConferenceMeeting extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
  declare uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare room_uid: number;

  @Column({ type: DataType.DATE, allowNull: false })
  declare started_at: Date;

  @Column({ type: DataType.DATE, allowNull: true })
  declare ended_at: Date | null;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  declare has_recording: boolean;

  @Column({ type: DataType.STRING(512), allowNull: true })
  declare recording_file_rel: string | null;
}
